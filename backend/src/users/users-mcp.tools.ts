import { Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { McpTool, registerMcpToolsFromInstance } from '../mcp/mcp-tool.decorator';
import { McpToolRegistry } from '../mcp/mcp-tool.registry';
import { UsersService } from './users.service';

@Injectable()
export class UsersMcpTools implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly registry: McpToolRegistry,
  ) {}

  onModuleInit() {
    registerMcpToolsFromInstance(this, this.registry);
  }

  @McpTool({
    name: 'count_active_users',
    description: 'Return the total count of active (non-disabled) users in the system.',
    inputSchema: z.object({}),
    requiredScopes: ['users:read'],
  })
  async countActiveUsers(): Promise<{ count: number }> {
    const result = await this.usersService.findAll({ page: 1, limit: 1 });
    return { count: result.total };
  }
}
