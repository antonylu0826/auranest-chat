import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { UsersModule } from '../users/users.module';

const isOidc = process.env.AUTH_MODE === 'oidc';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: isOidc ? undefined : (process.env.JWT_SECRET ?? 'dev-secret'),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
    }),
    ...(isOidc ? [] : [UsersModule]),
  ],
  providers: [isOidc ? OidcStrategy : LocalStrategy],
  controllers: isOidc ? [] : [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
