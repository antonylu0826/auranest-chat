import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { ReadStateService } from './read-state.service';

@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
@Controller('chat/read-state')
export class ReadStateController {
  constructor(private readonly readStateService: ReadStateService) {}

  @Get('unreads')
  @RequirePermissions('CHAT_CHANNEL_READ')
  getAllUnreads(@CurrentUser() user: { sub: string }) {
    return this.readStateService.getAllUnreads(user.sub);
  }

  @Post('channels/:channelId')
  @RequirePermissions('CHAT_CHANNEL_READ')
  markChannelRead(
    @Param('channelId') channelId: string,
    @Body('lastReadMessageId') lastReadMessageId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.readStateService.markChannelRead(channelId, user.sub, lastReadMessageId);
  }

  @Get('channels/:channelId')
  @RequirePermissions('CHAT_CHANNEL_READ')
  getChannelUnread(@Param('channelId') channelId: string, @CurrentUser() user: { sub: string }) {
    return this.readStateService.getChannelUnread(channelId, user.sub);
  }

  @Post('dms/:conversationId')
  @RequirePermissions('CHAT_CHANNEL_READ')
  markDmRead(
    @Param('conversationId') conversationId: string,
    @Body('lastReadMessageId') lastReadMessageId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.readStateService.markDmRead(conversationId, user.sub, lastReadMessageId);
  }

  @Get('dms/:conversationId')
  @RequirePermissions('CHAT_CHANNEL_READ')
  getDmUnread(@Param('conversationId') conversationId: string, @CurrentUser() user: { sub: string }) {
    return this.readStateService.getDmUnread(conversationId, user.sub);
  }
}
