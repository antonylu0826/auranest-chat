import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ChatGateway } from './chat.gateway';
import { ChannelsModule } from './channels/channels.module';
import { DmsModule } from './dms/dms.module';
import { MessagesModule } from './messages/messages.module';
import { ReactionsModule } from './reactions/reactions.module';
import { ReadStateModule } from './read-state/read-state.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ApiKeysModule,
    AuthModule,
    ChannelsModule,
    MessagesModule,
    DmsModule,
    ReactionsModule,
    ReadStateModule,
    WebhooksModule,
  ],
  providers: [ChatGateway, PermissionGuard],
  exports: [ChatGateway],
})
export class ChatModule {}
