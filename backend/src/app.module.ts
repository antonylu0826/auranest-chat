import { Module } from '@nestjs/common';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, UsersModule, MetaModule, ApiKeysModule, RolesModule],
})
export class AppModule {}
