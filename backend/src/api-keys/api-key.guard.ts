import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyRateLimiter } from './api-key-rate-limiter';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: ApiKeyRateLimiter,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
      res?: { setHeader: (name: string, value: string) => void };
    }>();

    const rawKey = request.headers['x-api-key'];
    if (!rawKey) return false;

    const hashedKey = createHash('sha256').update(rawKey).digest('hex');
    const now = new Date();

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        hashedKey,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { role: { include: { permissions: true } } },
    });

    if (!apiKey) return false;

    const { allowed, retryAfter } = this.rateLimiter.check(apiKey.id, apiKey.rateLimit);
    if (!allowed) {
      const response = ctx.switchToHttp().getResponse<{ setHeader: (n: string, v: string) => void }>();
      response.setHeader('Retry-After', String(retryAfter ?? 60));
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Fire-and-forget lastUsedAt update
    this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: now },
    }).catch((e: unknown) => console.error('[ApiKeyGuard] lastUsedAt update failed:', e));

    request.user = {
      sub: apiKey.id,
      roleNames: [apiKey.role.name],
      permissionPolicy: apiKey.role.permissionPolicy,
      permissions: apiKey.role.permissions.map((p) => p.permission),
      scopes: apiKey.scopes,
      isApiKey: true,
    };

    return true;
  }
}
