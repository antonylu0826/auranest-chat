import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { DmsService } from './dms.service';

@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
@Controller('chat/dms')
export class DmsController {
  constructor(private readonly dmsService: DmsService) {}

  @Get()
  @RequirePermissions('CHAT_CHANNEL_READ')
  findAll(@CurrentUser() user: { sub: string }) {
    return this.dmsService.findAll(user.sub);
  }

  @Get(':id')
  @RequirePermissions('CHAT_CHANNEL_READ')
  findOne(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.dmsService.findOne(id, user.sub);
  }

  @Post()
  @RequirePermissions('CHAT_CHANNEL_READ')
  getOrCreate(
    @Body('userId') targetUserId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.dmsService.getOrCreate(user.sub, targetUserId);
  }
}
