import { Logger } from '@nestjs/common';
import type { DMMF } from '@prisma/client/runtime/library';
import { z, ZodTypeAny } from 'zod';

const logger = new Logger('InputSchemaBuilder');

export function prismaFieldToZodSchema(
  field: DMMF.Field,
  enumsMap: Map<string, string[]>,
): ZodTypeAny {
  let schema: ZodTypeAny;

  if (field.kind === 'enum') {
    const values = enumsMap.get(field.type) ?? [];
    if (values.length === 0) {
      schema = z.string();
    } else {
      schema = z.enum(values as [string, ...string[]]);
    }
  } else {
    switch (field.type) {
      case 'String':
        schema = z.string();
        break;
      case 'Int':
      case 'Float':
        schema = z.number();
        break;
      case 'Boolean':
        schema = z.boolean();
        break;
      case 'DateTime':
        schema = z.string().describe('ISO 8601 date-time string');
        break;
      case 'Json':
        schema = z.record(z.string(), z.unknown());
        break;
      default:
        logger.warn(`Unknown Prisma scalar type "${field.type}" for field "${field.name}" — falling back to string`);
        schema = z.string();
    }
  }

  if (field.documentation) {
    schema = schema.describe(field.documentation);
  }

  return schema;
}

export function buildListSchema(): z.ZodObject<z.ZodRawShape> {
  return z.object({
    page:      z.number().optional().describe('Page number (1-based)'),
    limit:     z.number().optional().describe('Items per page (max 100)'),
    sortField: z.string().optional().describe('Field name to sort by'),
    sortOrder: z.enum(['ASC', 'DESC']).optional().describe('Sort direction'),
  });
}

export function buildCreateSchema(
  model: DMMF.Model,
  enumsMap: Map<string, string[]>,
): z.ZodObject<z.ZodRawShape> {
  const SYSTEM_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at']);
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of model.fields) {
    if (SYSTEM_FIELDS.has(field.name)) continue;
    if (field.kind === 'object') continue;

    const fieldSchema = prismaFieldToZodSchema(field, enumsMap);
    const isRequired = field.isRequired && !field.hasDefaultValue && !field.isUpdatedAt;
    shape[field.name] = isRequired ? fieldSchema : fieldSchema.optional();
  }

  return z.object(shape);
}

export function buildUpdateSchema(
  model: DMMF.Model,
  enumsMap: Map<string, string[]>,
): z.ZodObject<z.ZodRawShape> {
  const SYSTEM_FIELDS = new Set(['createdAt', 'updatedAt', 'created_at', 'updated_at']);
  const shape: Record<string, ZodTypeAny> = {};

  const idField = model.fields.find((f) => f.isId);
  if (idField) {
    shape[idField.name] = prismaFieldToZodSchema(idField, enumsMap);
  }

  for (const field of model.fields) {
    if (field.isId) continue;
    if (SYSTEM_FIELDS.has(field.name)) continue;
    if (field.kind === 'object') continue;

    shape[field.name] = prismaFieldToZodSchema(field, enumsMap).optional();
  }

  return z.object(shape);
}
