import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery } from '../common/pagination';
import { createApiKeySchema, updateApiKeySchema } from './dto/api-key.dto';
import { ApiKeysService } from './api-keys.service';

// API key management is ADMIN-only per user requirement.
@Controller('api-keys')
@UseGuards(JwtOrApiKeyGuard, AdminGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createApiKeySchema)) dto: ReturnType<typeof createApiKeySchema.parse>,
    @Request() req: { user?: { email?: string } },
  ) {
    return this.apiKeysService.create(dto, req.user?.email);
  }

  @Get()
  findAll(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.apiKeysService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.apiKeysService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateApiKeySchema)) dto: ReturnType<typeof updateApiKeySchema.parse>,
  ) {
    return this.apiKeysService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.apiKeysService.remove(id);
  }
}
