import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { PushService } from './push.service';

interface ResolvedMessage {
  id: string;
  content: string;
  senderId: string | null;
  channelId: string | null;
  dmId: string | null;
}

@Injectable()
export class PushNotificationListener {
  private readonly logger = new Logger(PushNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly gateway: ChatGateway,
  ) {}

  @OnEvent('chat.message.mentions-resolved')
  async handle(message: ResolvedMessage) {
    try {
      await this.processMessage(message);
    } catch (err) {
      this.logger.error('Push notification error:', err);
    }
  }

  private async processMessage(message: ResolvedMessage) {
    const recipientIds = await this.resolveRecipients(message);
    if (recipientIds.length === 0) return;

    const channel = message.channelId
      ? await this.prisma.channel.findUnique({
          where: { id: message.channelId },
          select: { name: true },
        })
      : null;

    const sender = message.senderId
      ? await this.prisma.user.findUnique({
          where: { id: message.senderId },
          select: { name: true, email: true },
        })
      : null;

    const title = channel ? `#${channel.name}` : (sender?.name ?? sender?.email ?? 'Message');
    const body = message.content.slice(0, 80);
    const tag = message.channelId
      ? `channel:${message.channelId}`
      : message.dmId
        ? `dm:${message.dmId}`
        : 'unknown';
    const url = message.channelId
      ? `/dashboard/chat/channels/${message.channelId}`
      : message.dmId
        ? `/dashboard/chat/dms/${message.dmId}`
        : '/dashboard/chat';

    for (const userId of recipientIds) {
      if (userId === message.senderId) continue;

      const isOnline = await this.gateway.isUserOnline(userId);
      if (isOnline) continue;

      const prefs = await this.pushService.getPreference(userId);
      if (!prefs.pushEnabled) continue;

      await this.pushService.sendToUser(userId, { title, body, url, tag }).catch((err: unknown) =>
        this.logger.error(`sendToUser failed for ${userId}`, err),
      );
    }
  }

  private async resolveRecipients(message: ResolvedMessage): Promise<string[]> {
    // DM — the other participant
    if (message.dmId) {
      const participants = await this.prisma.dmParticipant.findMany({
        where: { conversationId: message.dmId },
        select: { userId: true },
      });
      return participants.map((p) => p.userId).filter((id) => id !== message.senderId);
    }

    // Channel — only explicitly mentioned users
    if (message.channelId) {
      const mentions = await this.prisma.mention.findMany({
        where: { messageId: message.id },
        select: { mentionType: true, mentionedUserId: true },
      });

      const userIds = new Set<string>();

      for (const m of mentions) {
        if (m.mentionType === 'USER' && m.mentionedUserId) {
          userIds.add(m.mentionedUserId);
        } else if (m.mentionType === 'HERE' || m.mentionType === 'CHANNEL') {
          const members = await this.prisma.channelMember.findMany({
            where: { channelId: message.channelId! },
            select: { userId: true },
          });
          members.forEach((mem) => userIds.add(mem.userId));
          break;
        }
      }

      return [...userIds];
    }

    return [];
  }
}
