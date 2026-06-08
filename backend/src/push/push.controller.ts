import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { SubscribeDto } from './dto/subscribe.dto';
import { PushService } from './push.service';

@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.pushService.getVapidPublicKey();
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: { sub: string }, @Body() dto: SubscribeDto) {
    return this.pushService.subscribe(user.sub, dto);
  }

  @Post('unsubscribe')
  unsubscribe(@CurrentUser() user: { sub: string }, @Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(user.sub, body.endpoint);
  }

  @Get('preference')
  getPreference(@CurrentUser() user: { sub: string }) {
    return this.pushService.getPreference(user.sub);
  }

  @Patch('preference')
  setPreference(
    @CurrentUser() user: { sub: string },
    @Body() body: { pushEnabled: boolean },
  ) {
    return this.pushService.setPreference(user.sub, body.pushEnabled);
  }
}
