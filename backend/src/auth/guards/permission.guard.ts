import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@prisma/client';
import { SYSTEM_ADMIN_ROLE } from '../constants';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<{
      user?: { roleNames?: string[]; permissionPolicy?: string; permissions?: Permission[] };
    }>();
    if (!user) throw new ForbiddenException();

    // 1. ADMIN always bypasses
    if (user.roleNames?.includes(SYSTEM_ADMIN_ROLE)) return true;

    // 2. ALLOW_ALL policy bypasses
    if (user.permissionPolicy === 'ALLOW_ALL') return true;

    // 3. READ_ALL policy: auto-pass any *_READ permission
    if (user.permissionPolicy === 'READ_ALL' && required.some((p) => p.endsWith('_READ'))) {
      return true;
    }

    // 4. Explicit grant check (OR: any one of the required permissions suffices)
    if (required.some((p) => user.permissions?.includes(p))) return true;

    throw new ForbiddenException();
  }
}
