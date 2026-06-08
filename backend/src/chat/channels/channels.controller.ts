import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { ChannelMembersService } from './channel-members.service';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
@Controller('chat/channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly membersService: ChannelMembersService,
  ) {}

  @Get()
  @RequirePermissions('CHAT_CHANNEL_READ')
  findAll(@CurrentUser() user: { sub: string }) {
    return this.channelsService.findAll(user.sub);
  }

  @Get(':id')
  @RequirePermissions('CHAT_CHANNEL_READ')
  findOne(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.channelsService.findOne(id, user.sub);
  }

  @Post()
  @RequirePermissions('CHAT_CHANNEL_CREATE')
  create(@Body() dto: CreateChannelDto, @CurrentUser() user: { sub: string }) {
    return this.channelsService.create(user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions('CHAT_CHANNEL_CREATE')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.channelsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @RequirePermissions('CHAT_CHANNEL_DELETE')
  archive(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.channelsService.archive(id, user.sub);
  }

  // ── Members ─────────────────────────────────────────────────────────────

  @Get(':id/members')
  @RequirePermissions('CHAT_CHANNEL_READ')
  getMembers(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.membersService.findMembers(id, user.sub);
  }

  @Post(':id/members/:userId')
  @RequirePermissions('CHAT_CHANNEL_CREATE')
  addMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.membersService.addMember(id, user.sub, userId);
  }

  @Delete(':id/members/:userId')
  @RequirePermissions('CHAT_CHANNEL_CREATE')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.membersService.removeMember(id, user.sub, userId);
  }

  @Patch(':id/members/:userId/role')
  @RequirePermissions('CHAT_CHANNEL_CREATE')
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.membersService.updateRole(id, user.sub, userId, role);
  }
}
