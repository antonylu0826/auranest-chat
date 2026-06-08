import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { DmsController } from './dms.controller';
import { DmsService } from './dms.service';

@Module({
  imports: [ApiKeysModule, AuthModule],
  providers: [DmsService, PermissionGuard],
  controllers: [DmsController],
  exports: [DmsService],
})
export class DmsModule {}
