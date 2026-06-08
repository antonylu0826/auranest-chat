import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { ReactionsService } from './reactions.service';

@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
@Controller('chat/messages/:messageId/reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Get()
  @RequirePermissions('CHAT_CHANNEL_READ')
  getAggregated(@Param('messageId') messageId: string) {
    return this.reactionsService.getAggregated(messageId);
  }

  @Post(':emoji')
  @RequirePermissions('CHAT_CHANNEL_READ')
  add(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.reactionsService.add(messageId, user.sub, decodeURIComponent(emoji));
  }

  @Delete(':emoji')
  @RequirePermissions('CHAT_CHANNEL_READ')
  remove(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.reactionsService.remove(messageId, user.sub, decodeURIComponent(emoji));
  }
}
