import { createHash } from 'crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function participantsHash(id1: string, id2: string): string {
  const sorted = [id1, id2].sort().join(':');
  return createHash('sha256').update(sorted).digest('hex');
}

@Injectable()
export class DmsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get existing DM conversation or create a new one between two users. */
  async getOrCreate(requesterId: string, targetUserId: string) {
    if (requesterId === targetUserId) {
      throw new ConflictException('Cannot start a DM with yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const hash = participantsHash(requesterId, targetUserId);

    const existing = await this.prisma.directConversation.findUnique({
      where: { participantsHash: hash },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (existing) return existing;

    return this.prisma.directConversation.create({
      data: {
        participantsHash: hash,
        participants: {
          create: [{ userId: requesterId }, { userId: targetUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.directConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
  }

  async findOne(conversationId: string, userId: string) {
    const conv = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const isParticipant = conv.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant');
    return conv;
  }
}
