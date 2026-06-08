import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { MessagesModule } from '../messages/messages.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [ApiKeysModule, AuthModule, MessagesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PermissionGuard],
})
export class WebhooksModule {}
