import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { buildCreateSchema, buildListSchema, buildUpdateSchema } from './input-schema.builder';

type ToolSkeleton = Omit<McpToolDefinition, 'handler'>;

const ID_SCHEMA = z.object({
  id: z.string().describe('Record ID'),
});

@Injectable()
export class CrudToolFactory {
  private readonly logger = new Logger(CrudToolFactory.name);

  buildToolDefinitions(): ToolSkeleton[] {
    const { models, enums } = Prisma.dmmf.datamodel;

    const enumsMap = new Map<string, string[]>(
      enums.map((e) => [e.name, e.values.map((v) => v.name)]),
    );

    const tools: ToolSkeleton[] = [];

    for (const model of models) {
      const doc = model.documentation ?? '';

      if (doc.includes('@internal') || doc.includes('@mcp-exclude')) {
        this.logger.debug(`Skipping model "${model.name}" (marked @internal or @mcp-exclude)`);
        continue;
      }

      const dbTable = (model as { dbName?: string }).dbName ?? model.name.toLowerCase();
      const idField = model.fields.find((f) => f.isId);

      if (!idField) {
        this.logger.warn(`Model "${model.name}" has no single primary key — only list + create tools generated`);
      }

      const modelDoc = doc ? ` ${doc}` : '';

      tools.push({
        name: `list_${dbTable}`,
        description: `List ${dbTable} records with pagination.${modelDoc}`,
        inputSchema: buildListSchema(),
        requiredScopes: [`${dbTable}:read`],
      });

      tools.push({
        name: `create_${dbTable}`,
        description: `Create a new ${dbTable} record.${modelDoc}`,
        inputSchema: buildCreateSchema(model, enumsMap),
        requiredScopes: [`${dbTable}:write`],
      });

      if (!idField) continue;

      tools.push({
        name: `get_${dbTable}`,
        description: `Get a single ${dbTable} record by ID.${modelDoc}`,
        inputSchema: ID_SCHEMA,
        requiredScopes: [`${dbTable}:read`],
      });

      tools.push({
        name: `update_${dbTable}`,
        description: `Update an existing ${dbTable} record.${modelDoc}`,
        inputSchema: buildUpdateSchema(model, enumsMap),
        requiredScopes: [`${dbTable}:write`],
      });

      tools.push({
        name: `delete_${dbTable}`,
        description: `Delete a ${dbTable} record by ID.${modelDoc}`,
        inputSchema: ID_SCHEMA,
        requiredScopes: [`${dbTable}:write`],
      });
    }

    return tools;
  }
}
