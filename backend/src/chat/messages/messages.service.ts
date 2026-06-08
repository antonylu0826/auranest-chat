import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { requireChannelMember, requireDmParticipant } from '../chat-permissions';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

const PAGE_SIZE = 50;
const SEARCH_LIMIT = 30;

const SENDER_SELECT = { id: true, name: true, email: true };

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findByChannel(channelId: string, userId: string, before?: string) {
    await requireChannelMember(this.prisma, channelId, userId);
    return this.fetchMessages({ channelId }, before);
  }

  async findByDm(conversationId: string, userId: string, before?: string) {
    await requireDmParticipant(this.prisma, conversationId, userId);
    return this.fetchMessages({ dmId: conversationId }, before);
  }

  async findThreadReplies(parentId: string, userId: string) {
    const parent = await this.prisma.message.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Message not found');
    if (parent.channelId) await requireChannelMember(this.prisma, parent.channelId, userId);
    if (parent.dmId) await requireDmParticipant(this.prisma, parent.dmId, userId);

    return this.prisma.message.findMany({
      where: { parentId, deletedAt: null },
      include: { sender: { select: SENDER_SELECT }, reactions: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(senderId: string, dto: CreateMessageDto) {
    if (!dto.channelId && !dto.dmId) {
      throw new BadRequestException('Either channelId or dmId is required');
    }
    if (dto.channelId && dto.dmId) {
      throw new BadRequestException('channelId and dmId are mutually exclusive');
    }

    if (dto.channelId) await requireChannelMember(this.prisma, dto.channelId, senderId);
    if (dto.dmId) await requireDmParticipant(this.prisma, dto.dmId, senderId);

    if (dto.parentId) {
      const parent = await this.prisma.message.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.deletedAt) throw new NotFoundException('Parent message not found');
      if (parent.parentId) throw new BadRequestException('Replies cannot be nested beyond one level');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          content: dto.content,
          senderId,
          channelId: dto.channelId,
          dmId: dto.dmId,
          parentId: dto.parentId,
          clientNonce: dto.clientNonce,
        },
        include: { sender: { select: SENDER_SELECT }, reactions: true },
      });

      if (dto.parentId) {
        await tx.message.update({
          where: { id: dto.parentId },
          data: { replyCount: { increment: 1 } },
        });
      }

      if (dto.channelId) {
        await tx.channel.update({
          where: { id: dto.channelId },
          data: { lastMessageAt: msg.createdAt },
        });
      }
      if (dto.dmId) {
        await tx.directConversation.update({
          where: { id: dto.dmId },
          data: { lastMessageAt: msg.createdAt },
        });
      }

      return msg;
    });

    this.events.emit('chat.message.created', message);
    // Parse and persist @mentions asynchronously (non-blocking)
    this.parseMentions(dto.content, message).catch((err: unknown) =>
      this.logger.error('parseMentions failed', err),
    );
    return message;
  }

  async createFromWebhook(channelId: string, senderId: string, content: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return;

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { content, channelId, senderId },
        include: { sender: { select: SENDER_SELECT }, reactions: true },
      });
      await tx.channel.update({
        where: { id: channelId },
        data: { lastMessageAt: msg.createdAt },
      });
      return msg;
    });

    this.events.emit('chat.message.created', message);
    return message;
  }

  async search(query: string, userId: string) {
    if (!query.trim()) return [];

    const [memberships, dmParticipations] = await Promise.all([
      this.prisma.channelMember.findMany({ where: { userId }, select: { channelId: true } }),
      this.prisma.dmParticipant.findMany({ where: { userId }, select: { conversationId: true } }),
    ]);

    const channelIds = memberships.map((m) => m.channelId);
    const dmIds = dmParticipations.map((p) => p.conversationId);

    return this.prisma.message.findMany({
      where: {
        deletedAt: null,
        content: { contains: query, mode: 'insensitive' },
        OR: [
          ...(channelIds.length ? [{ channelId: { in: channelIds } }] : []),
          ...(dmIds.length ? [{ dmId: { in: dmIds } }] : []),
        ],
      },
      include: {
        sender: { select: SENDER_SELECT },
        channel: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_LIMIT,
    });
  }

  private async parseMentions(
    content: string,
    message: { id: string; channelId: string | null; dmId: string | null },
  ) {
    const regex = /@([a-zA-Z0-9._-]+)/g;
    const tokens: { token: string; type: 'USER' | 'HERE' | 'CHANNEL' }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const t = match[1].toLowerCase();
      if (t === 'here') tokens.push({ token: t, type: 'HERE' });
      else if (t === 'channel') tokens.push({ token: t, type: 'CHANNEL' });
      else tokens.push({ token: t, type: 'USER' });
    }

    if (tokens.length === 0) {
      this.events.emit('chat.message.mentions-resolved', message);
      return;
    }

    // Resolve USER mentions against channel/DM members
    let users: { id: string; name: string | null; email: string }[] = [];
    if (message.channelId) {
      const members = await this.prisma.channelMember.findMany({
        where: { channelId: message.channelId },
        select: { user: { select: { id: true, name: true, email: true } } },
      });
      users = members.map((m) => m.user);
    } else if (message.dmId) {
      const participants = await this.prisma.dmParticipant.findMany({
        where: { conversationId: message.dmId },
        select: { user: { select: { id: true, name: true, email: true } } },
      });
      users = participants.map((p) => p.user);
    }

    const seen = new Set<string>();
    const records: { messageId: string; mentionedUserId: string | null; mentionType: string }[] = [];

    for (const t of tokens) {
      if (t.type !== 'USER') {
        const key = t.type;
        if (!seen.has(key)) {
          seen.add(key);
          records.push({ messageId: message.id, mentionedUserId: null, mentionType: t.type });
        }
        continue;
      }

      const user = users.find((u) => {
        const nameLower = (u.name ?? '').toLowerCase();
        const emailLocal = u.email.toLowerCase().split('@')[0];
        // Match first name, full name (no spaces), or email local part
        return (
          nameLower.split(' ')[0] === t.token ||
          nameLower.replace(/\s+/g, '') === t.token ||
          emailLocal === t.token
        );
      });

      if (user) {
        const key = `user:${user.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          records.push({ messageId: message.id, mentionedUserId: user.id, mentionType: 'USER' });
        }
      }
    }

    if (records.length > 0) {
      await this.prisma.mention.createMany({ data: records, skipDuplicates: true });
    }

    this.events.emit('chat.message.mentions-resolved', message);
  }

  async update(messageId: string, userId: string, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot edit another user\'s message');

    return this.prisma.$transaction(async (tx) => {
      await tx.messageRevision.create({
        data: { messageId, content: message.content, editorId: userId },
      });
      const updated = await tx.message.update({
        where: { id: messageId },
        data: { content: dto.content, editedAt: new Date() },
        include: { sender: { select: SENDER_SELECT }, reactions: true },
      });
      this.events.emit('chat.message.updated', updated);
      return updated;
    });
  }

  async softDelete(messageId: string, userId: string, isAdmin = false) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');
    if (!isAdmin && message.senderId !== userId) {
      throw new ForbiddenException('Cannot delete another user\'s message');
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: '' },
    });
    this.events.emit('chat.message.deleted', { id: messageId, channelId: message.channelId, dmId: message.dmId });
    return deleted;
  }

  private async fetchMessages(
    where: { channelId?: string; dmId?: string },
    before?: string,
  ) {
    const cursor = before ? { id: before } : undefined;
    return this.prisma.message.findMany({
      where: { ...where, deletedAt: null, parentId: null },
      include: {
        sender: { select: SENDER_SELECT },
        reactions: true,
        _count: { select: { replies: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });
  }

}
