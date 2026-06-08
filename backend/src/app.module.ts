import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { McpModule } from './mcp/mcp.module';
import { MetaModule } from './meta/meta.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    MetaModule,
    ApiKeysModule,
    RolesModule,
    ChatModule,
    PushModule,
    McpModule,
  ],
})
export class AppModule {}
