import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { requireChannelMember, requireChannelOwner } from '../chat-permissions';

@Injectable()
export class ChannelMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMembers(channelId: string, requesterId: string) {
    await requireChannelMember(this.prisma, channelId, requesterId);
    return this.prisma.channelMember.findMany({
      where: { channelId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async addMember(channelId: string, inviterId: string, userId: string) {
    await requireChannelOwner(this.prisma, channelId, inviterId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.channelMember.create({
      data: { channelId, userId, role: 'MEMBER' },
    });
  }

  async removeMember(channelId: string, removerId: string, userId: string) {
    const removerMember = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: removerId } },
    });
    if (!removerMember) throw new ForbiddenException('Not a member');

    // OWNER can remove anyone; MEMBER can only remove themselves
    if (removerMember.role !== 'OWNER' && removerId !== userId) {
      throw new ForbiddenException('Only owners can remove other members');
    }

    await this.prisma.channelMember.delete({
      where: { channelId_userId: { channelId, userId } },
    });
  }

  async updateRole(channelId: string, operatorId: string, userId: string, role: string) {
    if (!['OWNER', 'MEMBER'].includes(role)) {
      throw new ForbiddenException('Invalid role');
    }
    await requireChannelOwner(this.prisma, channelId, operatorId);
    return this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { role },
    });
  }

}
