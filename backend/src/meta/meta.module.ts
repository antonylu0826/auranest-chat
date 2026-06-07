import { forwardRef, Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  imports: [forwardRef(() => ApiKeysModule)],
  controllers: [MetaController],
  providers: [MetaService],
  exports: [MetaService],
})
export class MetaModule {}
