import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireChannelOwner } from '../chat-permissions';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

function toSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `channel-${Date.now()}`;
}

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All non-archived channels the user is a member of (private) or public channels. */
  async findAll(userId: string) {
    return this.prisma.channel.findMany({
      where: {
        archivedAt: null,
        OR: [
          { isPrivate: false },
          { members: { some: { userId } } },
        ],
      },
      include: { _count: { select: { members: true } } },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
  }

  async findOne(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { _count: { select: { members: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.isPrivate) {
      const member = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!member) throw new ForbiddenException('Not a member of this channel');
    }
    return channel;
  }

  async create(userId: string, dto: CreateChannelDto) {
    const slug = dto.slug ?? toSlug(dto.name);
    const channel = await this.prisma.channel.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        topic: dto.topic,
        isPrivate: dto.isPrivate ?? false,
        createdById: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { _count: { select: { members: true } } },
    });
    return channel;
  }

  async update(channelId: string, userId: string, dto: UpdateChannelDto) {
    await requireChannelOwner(this.prisma,channelId, userId);
    return this.prisma.channel.update({
      where: { id: channelId },
      data: { name: dto.name, description: dto.description, topic: dto.topic },
    });
  }

  async archive(channelId: string, userId: string) {
    await requireChannelOwner(this.prisma,channelId, userId);
    const channel = await this.prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
    return this.prisma.channel.update({
      where: { id: channelId },
      data: {
        archivedAt: new Date(),
        // Rename slug so it doesn't block a new channel with the same name.
        slug: `${channel.slug}:archived:${channel.id}`,
      },
    });
  }

}
