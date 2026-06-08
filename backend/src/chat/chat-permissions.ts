import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function requireChannelMember(
  prisma: PrismaService,
  channelId: string,
  userId: string,
): Promise<void> {
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (!member) throw new ForbiddenException('Not a member of this channel');
}

export async function requireDmParticipant(
  prisma: PrismaService,
  conversationId: string,
  userId: string,
): Promise<void> {
  const participant = await prisma.dmParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new ForbiddenException('Not a participant of this conversation');
}

export async function requireChannelOwner(
  prisma: PrismaService,
  channelId: string,
  userId: string,
): Promise<void> {
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (!member || member.role !== 'OWNER') {
    throw new ForbiddenException('Only channel owners can perform this action');
  }
}
