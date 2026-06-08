import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async add(messageId: string, userId: string, emoji: string) {
    const message = await this.findMessage(messageId, userId);

    try {
      const reaction = await this.prisma.reaction.create({
        data: { messageId, userId, emoji },
      });
      const aggregated = await this.getAggregated(messageId);
      this.events.emit('chat.reaction.added', { messageId, userId, emoji, channelId: message.channelId, dmId: message.dmId, aggregated });
      return aggregated;
    } catch {
      throw new ConflictException('Already reacted with this emoji');
    }
  }

  async remove(messageId: string, userId: string, emoji: string) {
    const message = await this.findMessage(messageId, userId);

    const reaction = await this.prisma.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (!reaction) throw new NotFoundException('Reaction not found');

    await this.prisma.reaction.delete({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    const aggregated = await this.getAggregated(messageId);
    this.events.emit('chat.reaction.removed', { messageId, userId, emoji, channelId: message.channelId, dmId: message.dmId, aggregated });
    return aggregated;
  }

  async getAggregated(messageId: string) {
    const reactions = await this.prisma.reaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });

    const map = new Map<string, string[]>();
    for (const r of reactions) {
      const users = map.get(r.emoji) ?? [];
      users.push(r.userId);
      map.set(r.emoji, users);
    }

    return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds }));
  }

  private async findMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');

    if (message.channelId) {
      const member = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: message.channelId, userId } },
      });
      if (!member) throw new ForbiddenException('Not a member of this channel');
    }
    if (message.dmId) {
      const participant = await this.prisma.dmParticipant.findUnique({
        where: { conversationId_userId: { conversationId: message.dmId, userId } },
      });
      if (!participant) throw new ForbiddenException('Not a participant of this conversation');
    }
    return message;
  }
}
