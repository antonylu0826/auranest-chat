import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Permission } from '@prisma/client';
import { SYSTEM_ADMIN_ROLE } from '../auth/constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, ReplacePermissionsDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        permissions: { select: { permission: true } },
        _count: { select: { userRoles: true, apiKeys: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      isSystem: r.isSystem,
      permissionPolicy: r.permissionPolicy,
      permissions: r.permissions.map((p) => p.permission),
      userCount: r._count.userRoles,
      apiKeyCount: r._count.apiKeys,
    }));
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { select: { permission: true } }, _count: { select: { userRoles: true, apiKeys: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      isSystem: role.isSystem,
      permissionPolicy: role.permissionPolicy,
      permissions: role.permissions.map((p) => p.permission),
      userCount: role._count.userRoles,
      apiKeyCount: role._count.apiKeys,
    };
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        permissionPolicy: dto.permissionPolicy,
        isSystem: false,
        permissions: {
          create: dto.permissions.map((p) => ({ permission: p })),
        },
      },
      include: { permissions: { select: { permission: true } }, _count: { select: { userRoles: true, apiKeys: true } } },
    });
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      isSystem: role.isSystem,
      permissionPolicy: role.permissionPolicy,
      permissions: role.permissions.map((p) => p.permission),
      userCount: role._count.userRoles,
      apiKeyCount: role._count.apiKeys,
    };
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.permissions !== undefined && role.name === SYSTEM_ADMIN_ROLE) {
      throw new BadRequestException('ADMIN permissions are managed via guard bypass and cannot be set here');
    }

    if (dto.permissions !== undefined) {
      // Atomic update: metadata + permission replacement in one transaction
      await this.prisma.$transaction([
        this.prisma.role.update({
          where: { id },
          data: {
            ...(dto.displayName !== undefined && { displayName: dto.displayName }),
            ...(dto.permissionPolicy !== undefined && { permissionPolicy: dto.permissionPolicy }),
          },
        }),
        this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        this.prisma.rolePermission.createMany({
          data: dto.permissions.map((p) => ({ roleId: id, permission: p })),
        }),
      ]);
      return this.findOne(id);
    }

    await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.permissionPolicy !== undefined && { permissionPolicy: dto.permissionPolicy }),
      },
    });
    return this.findOne(id);
  }

  async replacePermissions(id: string, dto: ReplacePermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === SYSTEM_ADMIN_ROLE) {
      throw new BadRequestException('ADMIN permissions are managed via guard bypass and cannot be set here');
    }

    const perms: Permission[] = dto.permissions;
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: id, permission: p })),
      }),
    ]);
    return this.findOne(id);
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true, apiKeys: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role._count.userRoles > 0 || role._count.apiKeys > 0) {
      throw new BadRequestException('Cannot delete a role that is assigned to users or API keys');
    }
    await this.prisma.role.delete({ where: { id } });
  }
}
