import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { ReadStateController } from './read-state.controller';
import { ReadStateService } from './read-state.service';

@Module({
  imports: [ApiKeysModule, AuthModule],
  providers: [ReadStateService, PermissionGuard],
  controllers: [ReadStateController],
  exports: [ReadStateService],
})
export class ReadStateModule {}
