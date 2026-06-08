import { Global, Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrudExecutor } from './auto/crud-executor';
import { CrudToolFactory } from './auto/crud-tool.factory';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpToolRegistry } from './mcp-tool.registry';

@Global()
@Module({
  imports: [PrismaModule, ApiKeysModule],
  providers: [CrudToolFactory, CrudExecutor, McpToolRegistry, McpService],
  controllers: [McpController],
  exports: [McpToolRegistry],
})
export class McpModule {}
