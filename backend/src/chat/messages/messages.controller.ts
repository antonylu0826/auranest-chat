import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessagesService } from './messages.service';

interface JwtUser {
  sub: string;
  roleNames: string[];
}

@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
@Controller('chat')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('search')
  @RequirePermissions('CHAT_CHANNEL_READ')
  search(@Query('q') q: string | undefined, @CurrentUser() user: JwtUser) {
    if (!q?.trim()) throw new BadRequestException('q is required');
    return this.messagesService.search(q.trim(), user.sub);
  }

  @Get('channels/:channelId/messages')
  @RequirePermissions('CHAT_CHANNEL_READ')
  findByChannel(
    @Param('channelId') channelId: string,
    @Query('before') before: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.messagesService.findByChannel(channelId, user.sub, before);
  }

  @Get('dms/:conversationId/messages')
  @RequirePermissions('CHAT_CHANNEL_READ')
  findByDm(
    @Param('conversationId') conversationId: string,
    @Query('before') before: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.messagesService.findByDm(conversationId, user.sub, before);
  }

  @Get('messages/:messageId/replies')
  @RequirePermissions('CHAT_CHANNEL_READ')
  findReplies(@Param('messageId') messageId: string, @CurrentUser() user: JwtUser) {
    return this.messagesService.findThreadReplies(messageId, user.sub);
  }

  @Patch('messages/:messageId')
  @RequirePermissions('CHAT_CHANNEL_READ')
  update(
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.messagesService.update(messageId, user.sub, dto);
  }

  @Delete('messages/:messageId')
  @RequirePermissions('CHAT_MESSAGE_DELETE')
  delete(@Param('messageId') messageId: string, @CurrentUser() user: JwtUser) {
    const isAdmin = user.roleNames.includes('ADMIN');
    return this.messagesService.softDelete(messageId, user.sub, isAdmin);
  }
}
