import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { MetaService, SchemaMeta } from './meta.service';

@Controller('meta')
@UseGuards(JwtOrApiKeyGuard, AdminGuard)
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('schema')
  schema(): SchemaMeta {
    return this.metaService.buildMeta();
  }
}
