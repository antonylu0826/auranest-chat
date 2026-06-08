import * as crypto from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireChannelMember } from '../chat-permissions';
import { MessagesService } from '../messages/messages.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

const TOKEN_PREFIX = 'awh_';
const TOKEN_BYTES = 32; // 64 hex chars

function generateToken(): { raw: string; prefix: string; hash: string } {
  const raw = TOKEN_PREFIX + crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const prefix = raw.slice(0, 16);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, hash };
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async findByChannel(channelId: string, requesterId: string) {
    await requireChannelMember(this.prisma,channelId, requesterId);
    return this.prisma.incomingWebhook.findMany({
      where: { channelId },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(channelId: string, dto: CreateWebhookDto, requesterId: string) {
    await requireChannelMember(this.prisma,channelId, requesterId);
    const { raw, prefix, hash } = generateToken();

    const webhook = await this.prisma.incomingWebhook.create({
      data: {
        channelId,
        name: dto.name,
        prefix,
        tokenHash: hash,
        createdById: requesterId,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { ...webhook, token: raw };
  }

  async update(webhookId: string, dto: UpdateWebhookDto, requesterId: string) {
    const webhook = await this.prisma.incomingWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await requireChannelMember(this.prisma,webhook.channelId, requesterId);

    return this.prisma.incomingWebhook.update({
      where: { id: webhookId },
      data: dto,
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async remove(webhookId: string, requesterId: string) {
    const webhook = await this.prisma.incomingWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await requireChannelMember(this.prisma,webhook.channelId, requesterId);

    await this.prisma.incomingWebhook.delete({ where: { id: webhookId } });
  }

  async postMessage(rawToken: string, content: string) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const webhook = await this.prisma.incomingWebhook.findUnique({ where: { tokenHash: hash } });

    if (!webhook) throw new UnauthorizedException('Invalid webhook token');
    if (!webhook.isActive) throw new ForbiddenException('Webhook is disabled');

    await this.messagesService.createFromWebhook(webhook.channelId, webhook.createdById, content);
  }

}
