import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { PushNotificationListener } from './push-notification.listener';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [AuthModule, ChatModule],
  controllers: [PushController],
  providers: [PushService, PushNotificationListener],
  exports: [PushService],
})
export class PushModule {}
