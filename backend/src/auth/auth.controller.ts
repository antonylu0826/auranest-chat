import { Body, Controller, ForbiddenException, Get, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Permission } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt.guard';

function buildTokenPayload(user: {
  id: string;
  email: string;
  name?: string | null;
  userRoles: { role: { name: string; permissionPolicy: string; permissions: { permission: Permission }[] } }[];
}) {
  const roles = user.userRoles.map((ur) => ur.role);
  const roleNames = roles.map((r) => r.name);

  const policyOrder: Record<string, number> = { ALLOW_ALL: 2, READ_ALL: 1, DENY_ALL: 0 };
  const effectivePolicy = roles.reduce(
    (best, r) => (policyOrder[r.permissionPolicy] > policyOrder[best] ? r.permissionPolicy : best),
    'DENY_ALL',
  );

  const permissions = [...new Set(roles.flatMap((r) => r.permissions.map((p) => p.permission)))];
  const roleName = roleNames.includes('ADMIN') ? 'ADMIN' : (roleNames[0] || '');

  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    roleName,
    roleNames,
    permissionPolicy: effectivePolicy,
    permissions,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const hashed = await bcrypt.hash(dto.password, 12);
    await this.usersService.create({ email: dto.email, password: hashed, name: dto.name });
    // Reload with role+permissions for JWT signing
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Registration failed');
    const payload = buildTokenPayload(user);
    const token = this.jwtService.sign(payload);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, roleNames: payload.roleNames },
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    const payload = buildTokenPayload(user);
    const token = this.jwtService.sign(payload);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, roleNames: payload.roleNames },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: { user: { sub: string; email: string; roleName: string } }) {
    return req.user;
  }
}
