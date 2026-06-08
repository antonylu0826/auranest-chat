import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireChannelMember, requireDmParticipant } from '../chat-permissions';

@Injectable()
export class ReadStateService {
  constructor(private readonly prisma: PrismaService) {}

  async markChannelRead(channelId: string, userId: string, lastReadMessageId: string) {
    await requireChannelMember(this.prisma,channelId, userId);
    return this.prisma.channelRead.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: { lastReadMessageId, lastReadAt: new Date() },
      create: { channelId, userId, lastReadMessageId, lastReadAt: new Date() },
    });
  }

  async getChannelUnread(channelId: string, userId: string): Promise<number> {
    await requireChannelMember(this.prisma,channelId, userId);

    const readState = await this.prisma.channelRead.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });

    if (!readState?.lastReadMessageId) {
      return this.prisma.message.count({ where: { channelId, parentId: null, deletedAt: null } });
    }

    const lastRead = await this.prisma.message.findUnique({ where: { id: readState.lastReadMessageId } });
    if (!lastRead) return 0;

    return this.prisma.message.count({
      where: { channelId, parentId: null, deletedAt: null, createdAt: { gt: lastRead.createdAt } },
    });
  }

  async markDmRead(conversationId: string, userId: string, lastReadMessageId: string) {
    await requireDmParticipant(this.prisma,conversationId, userId);
    return this.prisma.dmRead.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: { lastReadMessageId, lastReadAt: new Date() },
      create: { conversationId, userId, lastReadMessageId, lastReadAt: new Date() },
    });
  }

  async getDmUnread(conversationId: string, userId: string): Promise<number> {
    await requireDmParticipant(this.prisma,conversationId, userId);

    const readState = await this.prisma.dmRead.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!readState?.lastReadMessageId) {
      return this.prisma.message.count({ where: { dmId: conversationId, parentId: null, deletedAt: null } });
    }

    const lastRead = await this.prisma.message.findUnique({ where: { id: readState.lastReadMessageId } });
    if (!lastRead) return 0;

    return this.prisma.message.count({
      where: { dmId: conversationId, parentId: null, deletedAt: null, createdAt: { gt: lastRead.createdAt } },
    });
  }

  /** Snapshot of unread counts across all channels and DMs for a user. Used on initial load. */
  async getAllUnreads(userId: string) {
    const [channelMemberships, dmParticipations] = await Promise.all([
      this.prisma.channelMember.findMany({ where: { userId }, select: { channelId: true } }),
      this.prisma.dmParticipant.findMany({ where: { userId }, select: { conversationId: true } }),
    ]);

    const [channelUnreads, dmUnreads] = await Promise.all([
      Promise.all(
        channelMemberships.map(async (m) => {
          const [count, mentionCount] = await Promise.all([
            this.getChannelUnread(m.channelId, userId),
            this.getChannelMentionCount(m.channelId, userId),
          ]);
          return { channelId: m.channelId, count, mentionCount };
        }),
      ),
      Promise.all(
        dmParticipations.map(async (p) => {
          const [count, mentionCount] = await Promise.all([
            this.getDmUnread(p.conversationId, userId),
            this.getDmMentionCount(p.conversationId, userId),
          ]);
          return { conversationId: p.conversationId, count, mentionCount };
        }),
      ),
    ]);

    return { channels: channelUnreads, dms: dmUnreads };
  }

  private async getChannelMentionCount(channelId: string, userId: string): Promise<number> {
    const readState = await this.prisma.channelRead.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });

    const afterDate = readState?.lastReadMessageId
      ? (await this.prisma.message.findUnique({ where: { id: readState.lastReadMessageId } }))?.createdAt ?? null
      : null;

    return this.prisma.mention.count({
      where: {
        mentionedUserId: userId,
        message: {
          channelId,
          deletedAt: null,
          parentId: null,
          ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
        },
      },
    });
  }

  private async getDmMentionCount(conversationId: string, userId: string): Promise<number> {
    const readState = await this.prisma.dmRead.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    const afterDate = readState?.lastReadMessageId
      ? (await this.prisma.message.findUnique({ where: { id: readState.lastReadMessageId } }))?.createdAt ?? null
      : null;

    return this.prisma.mention.count({
      where: {
        mentionedUserId: userId,
        message: {
          dmId: conversationId,
          deletedAt: null,
          parentId: null,
          ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
        },
      },
    });
  }

}
