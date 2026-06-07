import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../decorators/scopes.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @Scopes() decorator — allow all callers
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<{
      user?: { isApiKey?: boolean; scopes?: string[] };
    }>();

    // JWT users are not scope-restricted
    if (!user?.isApiKey) return true;

    const granted = user.scopes ?? [];

    // Wildcard "*" grants everything
    if (granted.includes('*')) return true;

    const allowed = required.every((req) => {
      const [reqModule, reqAction] = req.split(':');
      return granted.some((g) => {
        if (g === '*') return true;
        const [gModule, gAction] = g.split(':');
        if (gModule !== reqModule) return false;
        return gAction === '*' || gAction === reqAction;
      });
    });

    if (!allowed) throw new ForbiddenException('Insufficient API key scopes');
    return true;
  }
}
