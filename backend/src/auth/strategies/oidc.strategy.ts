import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SYSTEM_ADMIN_ROLE, SYSTEM_USER_ROLE } from '../constants';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: process.env.OIDC_JWKS_URL ?? '',
      }),
      issuer: process.env.OIDC_ISSUER,
      audience: process.env.OIDC_AUDIENCE,
      algorithms: ['RS256'],
    });
  }

  // TODO (OIDC): permissionPolicy and permissions are always DENY_ALL/[] for OIDC users.
  // OIDC tokens are issued by Keycloak — app-level permissions cannot be embedded at login.
  // ADMIN bypass still works via roleNames check. READ_ALL/ALLOW_ALL unavailable in OIDC mode.
  // Resolution: out of scope for pilot (AUTH_MODE=local is the test target).
  validate(payload: Record<string, unknown>) {
    const roles =
      (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
    const roleNames = roles.includes(SYSTEM_ADMIN_ROLE) ? [SYSTEM_ADMIN_ROLE] : [SYSTEM_USER_ROLE];
    return {
      sub: payload.sub,
      email: payload.email,
      roleNames,
      permissionPolicy: 'DENY_ALL' as const,
      permissions: [],
    };
  }
}
