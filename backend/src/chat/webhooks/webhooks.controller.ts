import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { SendWebhookMessageDto } from './dto/send-webhook-message.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('chat')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // ── Management routes (JWT required) ─────────────────────────────────────

  @UseGuards(JwtOrApiKeyGuard, PermissionGuard)
  @Get('channels/:channelId/webhooks')
  findByChannel(
    @Param('channelId') channelId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.webhooksService.findByChannel(channelId, user.sub);
  }

  @UseGuards(JwtOrApiKeyGuard, PermissionGuard)
  @Post('channels/:channelId/webhooks')
  create(
    @Param('channelId') channelId: string,
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.webhooksService.create(channelId, dto, user.sub);
  }

  @UseGuards(JwtOrApiKeyGuard, PermissionGuard)
  @Patch('webhooks/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.webhooksService.update(id, dto, user.sub);
  }

  @UseGuards(JwtOrApiKeyGuard, PermissionGuard)
  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.webhooksService.remove(id, user.sub);
  }

  // ── Public endpoint (no auth, token in path) ─────────────────────────────

  @Post('webhooks/incoming/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  postMessage(
    @Param('token') token: string,
    @Body() dto: SendWebhookMessageDto,
  ) {
    return this.webhooksService.postMessage(token, dto.content);
  }
}
