import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { paginationQuerySchema, type PaginationQuery } from '../common/pagination';
import { CreateUserDto, UpdateRolesDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

// User management is ADMIN-only (AdminGuard).
// If custom roles should manage users in future, switch to PermissionGuard + @RequirePermissions.
@Controller('users')
@UseGuards(JwtOrApiKeyGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 12);
    return this.usersService.create({ ...dto, password: hashed });
  }

  @Get()
  findAll(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Put(':id/roles')
  updateRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.usersService.updateRoles(id, dto.roleIds);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
