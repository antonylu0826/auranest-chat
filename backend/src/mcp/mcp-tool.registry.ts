import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CrudExecutor } from './auto/crud-executor';
import { CrudToolFactory } from './auto/crud-tool.factory';
import type { McpCallContext, McpToolDefinition } from './types';

function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function getModelNameForTool(toolName: string): { modelName: string; operation: string } | null {
  const ops = ['list_', 'get_', 'create_', 'update_', 'delete_'];
  for (const op of ops) {
    if (toolName.startsWith(op)) {
      const dbTable = toolName.slice(op.length);
      const model = Prisma.dmmf.datamodel.models.find(
        (m) => ((m as { dbName?: string }).dbName ?? m.name.toLowerCase()) === dbTable,
      );
      if (model) {
        return { modelName: model.name, operation: op.replace('_', '') };
      }
    }
  }
  return null;
}

export function matchScope(grantedScopes: string[], requiredScope: string): boolean {
  if (grantedScopes.includes('*')) return true;
  const [reqModule, reqAction] = requiredScope.split(':');
  return grantedScopes.some((g) => {
    if (g === '*') return true;
    const [gModule, gAction] = g.split(':');
    if (gModule !== reqModule) return false;
    return gAction === '*' || gAction === reqAction;
  });
}

@Injectable()
export class McpToolRegistry implements OnModuleInit {
  private readonly logger = new Logger(McpToolRegistry.name);
  private readonly toolMap = new Map<string, McpToolDefinition>();

  constructor(
    private readonly factory: CrudToolFactory,
    private readonly executor: CrudExecutor,
  ) {}

  onModuleInit() {
    // Layer 1: auto CRUD tools from DMMF
    const skeletons = this.factory.buildToolDefinitions();

    for (const skeleton of skeletons) {
      const meta = getModelNameForTool(skeleton.name);
      if (!meta) {
        this.logger.warn(`Could not resolve model for tool "${skeleton.name}" — skipping`);
        continue;
      }

      const { modelName, operation } = meta;
      const tool: McpToolDefinition = {
        ...skeleton,
        handler: (args: unknown) =>
          this.executor.execute(modelName, operation as Parameters<CrudExecutor['execute']>[1], args),
      };

      this.toolMap.set(skeleton.name, tool);
    }

    this.logger.log(`McpToolRegistry initialized with ${this.toolMap.size} Layer 1 tools`);
  }

  listTools(ctx: McpCallContext): McpToolDefinition[] {
    return Array.from(this.toolMap.values()).filter((tool) =>
      tool.requiredScopes.every((scope) => matchScope(ctx.scopes, scope)),
    );
  }

  getTool(name: string): McpToolDefinition | undefined {
    return this.toolMap.get(name);
  }

  registerTool(tool: McpToolDefinition): void {
    if (this.toolMap.has(tool.name)) {
      this.logger.log(`Tool "${tool.name}" overridden by Layer 2 custom provider`);
    }
    this.toolMap.set(tool.name, tool);
  }
}
