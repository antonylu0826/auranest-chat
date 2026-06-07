import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Permission } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  roleNames: string[];
  permissionPolicy: string;
  permissions: Permission[];
}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload) {
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      roleNames: payload.roleNames ?? [],
      permissionPolicy: payload.permissionPolicy ?? 'DENY_ALL',
      permissions: payload.permissions ?? [],
    };
  }
}
