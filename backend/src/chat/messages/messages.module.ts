import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [ApiKeysModule, AuthModule],
  providers: [MessagesService, PermissionGuard],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
