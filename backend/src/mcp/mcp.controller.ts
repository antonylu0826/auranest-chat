import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import type { McpCallContext } from './types';
import { McpService } from './mcp.service';
import { McpToolRegistry } from './mcp-tool.registry';

interface ApiKeyUser {
  scopes?: string[];
  isApiKey?: boolean;
  roleNames?: string[];
}

@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly registry: McpToolRegistry,
  ) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  async handlePost(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const user = (req as unknown as { user?: ApiKeyUser }).user;

    const ctx: McpCallContext = {
      scopes: user?.scopes ?? [],
      isApiKey: user?.isApiKey ?? false,
      roleNames: user?.roleNames ?? [],
    };

    const server = this.mcpService.createServer(ctx);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body as unknown);
  }

  @Get('health')
  getHealth(): object {
    const allToolsCtx: McpCallContext = { scopes: ['*'], isApiKey: true, roleNames: [] };
    const toolCount = this.registry.listTools(allToolsCtx).length;
    return {
      status: 'ok',
      serverInfo: {
        name: process.env['npm_package_name'] ?? 'auranest-app',
        version: process.env['npm_package_version'] ?? '1.0.0',
      },
      toolCount,
    };
  }
}
