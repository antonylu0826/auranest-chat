import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toPrismaOrderBy, toPrismaPage } from '../../common/pagination';

type Operation = 'list' | 'get' | 'create' | 'update' | 'delete';

const SYSTEM_FIELDS = new Set(['id', 'createdAt', 'updatedAt']);

function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function getModelScalarFields(modelName: string): Set<string> {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) return new Set();
  return new Set(
    model.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => f.name),
  );
}

function getDefaultOrderBy(modelName: string): Record<string, 'asc' | 'desc'> {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) return { id: 'asc' };
  const hasCreatedAt = model.fields.some((f) => f.name === 'createdAt');
  return hasCreatedAt ? { createdAt: 'desc' } : { id: 'asc' };
}

function sanitize(data: unknown, allowedFields: Set<string>): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) return {};
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (allowedFields.has(k) && !SYSTEM_FIELDS.has(k)) {
      result[k] = v;
    }
  }
  return result;
}

@Injectable()
export class CrudExecutor {
  private readonly logger = new Logger(CrudExecutor.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    modelName: string,
    operation: Operation,
    args: unknown,
  ): Promise<{ error?: boolean; message?: string; data?: unknown; total?: number } | unknown> {
    const delegate = (this.prisma as unknown as Record<string, unknown>)[lcFirst(modelName)];
    if (!delegate || typeof delegate !== 'object') {
      return { error: true, message: `Model "${modelName}" not found in Prisma client` };
    }

    const prismaModel = delegate as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const safeArgs = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {};

    try {
      switch (operation) {
        case 'list': {
          const page = typeof safeArgs['page'] === 'number' ? safeArgs['page'] : 1;
          const limit = typeof safeArgs['limit'] === 'number' ? Math.min(safeArgs['limit'], 100) : 20;
          const sortField = typeof safeArgs['sortField'] === 'string' ? safeArgs['sortField'] : undefined;
          const sortOrder = safeArgs['sortOrder'] === 'ASC' ? 'ASC' : 'DESC';

          const scalarFields = Array.from(getModelScalarFields(modelName));
          const orderBy = toPrismaOrderBy(
            { sortField, sortOrder },
            scalarFields,
            getDefaultOrderBy(modelName),
          );
          const { skip, take } = toPrismaPage({ page, limit });

          const [data, total] = await Promise.all([
            prismaModel['findMany']({ skip, take, orderBy }),
            prismaModel['count'](),
          ]);
          return { data, total };
        }

        case 'get': {
          const id = safeArgs['id'];
          if (!id) return { error: true, message: 'id is required' };
          const record = await prismaModel['findUnique']({ where: { id } });
          if (!record) return { error: true, message: 'Record not found' };
          return record;
        }

        case 'create': {
          const allowedFields = getModelScalarFields(modelName);
          const data = sanitize(args, allowedFields);
          return await prismaModel['create']({ data });
        }

        case 'update': {
          const id = safeArgs['id'];
          if (!id) return { error: true, message: 'id is required' };
          const allowedFields = getModelScalarFields(modelName);
          const { id: _id, ...rest } = safeArgs;
          void _id;
          const data = sanitize(rest, allowedFields);
          return await prismaModel['update']({ where: { id }, data });
        }

        case 'delete': {
          const id = safeArgs['id'];
          if (!id) return { error: true, message: 'id is required' };
          await prismaModel['delete']({ where: { id } });
          return { success: true };
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`CrudExecutor ${modelName}.${operation} failed: ${message}`);
      return { error: true, message };
    }
  }
}
