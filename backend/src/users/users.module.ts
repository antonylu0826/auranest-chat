import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsersController } from './users.controller';
import { UsersMcpTools } from './users-mcp.tools';
import { UsersService } from './users.service';

@Module({
  imports: [ApiKeysModule],
  controllers: [UsersController],
  providers: [UsersService, UsersMcpTools],
  exports: [UsersService],
})
export class UsersModule {}
