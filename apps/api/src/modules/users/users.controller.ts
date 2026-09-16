import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Joriy foydalanuvchi qisqa profili (dashboard shell uchun)' })
  async myProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findById(user.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_READ)
  @ApiOperation({ summary: 'Foydalanuvchilar ro‘yxati (sahifalash, qidiruv, filtr)' })
  async list(@Query() query: QueryUserDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_READ)
  @ApiOperation({ summary: 'Foydalanuvchi tafsilotlari (admin ko‘rinishi)' })
  async detail(@Param('id') id: string) {
    return this.users.findAdminDetail(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi foydalanuvchi yaratish (admin tomonidan)' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.users.create(dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_UPDATE)
  @ApiOperation({ summary: 'Foydalanuvchi ma’lumotlari, tashkiloti va rollarini tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.users.update(id, dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_DELETE)
  @ApiOperation({ summary: 'Foydalanuvchini faolsizlantirish (soft delete)' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.users.deactivate(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}
