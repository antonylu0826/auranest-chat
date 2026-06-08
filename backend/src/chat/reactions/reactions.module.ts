import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

@Module({
  imports: [ApiKeysModule, AuthModule],
  providers: [ReactionsService, PermissionGuard],
  controllers: [ReactionsController],
  exports: [ReactionsService],
})
export class ReactionsModule {}
