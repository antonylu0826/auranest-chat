import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { ChannelMembersService } from './channel-members.service';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [ApiKeysModule, AuthModule],
  providers: [ChannelsService, ChannelMembersService, PermissionGuard],
  controllers: [ChannelsController],
  exports: [ChannelsService, ChannelMembersService],
})
export class ChannelsModule {}
