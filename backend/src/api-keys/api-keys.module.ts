import { forwardRef, Module } from '@nestjs/common';
import { MetaModule } from '../meta/meta.module';
import { ApiKeyRateLimiter } from './api-key-rate-limiter';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Module({
  imports: [forwardRef(() => MetaModule)],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard, ApiKeyRateLimiter, JwtOrApiKeyGuard, JwtAuthGuard],
  exports: [ApiKeyGuard, ApiKeyRateLimiter, JwtOrApiKeyGuard, JwtAuthGuard],
})
export class ApiKeysModule {}
