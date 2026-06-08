import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!subject || !publicKey || !privateKey) {
      this.logger.warn('VAPID env vars not set — web push disabled');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.logger.log('VAPID details configured');
  }

  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? '' };
  }

  async subscribe(userId: string, dto: SubscribeDto) {
    // Delete any existing subscription for this endpoint belonging to a DIFFERENT user
    // before upserting, preventing one user from overwriting another's subscription (IDOR).
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint: dto.endpoint, NOT: { userId } },
    });
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }

  async getPreference(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushEnabled: true },
    });
    return { pushEnabled: user?.pushEnabled ?? true };
  }

  async setPreference(userId: string, pushEnabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushEnabled },
    });
    return { pushEnabled };
  }

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; url: string; tag: string },
  ) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return;

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        ),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({
            where: { id: subscriptions[i].id },
          }).catch(() => undefined);
        } else {
          this.logger.error(`Push failed for sub ${subscriptions[i].id}: ${String(result.reason)}`);
        }
      }
    }
  }
}
