import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
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
  @ApiOperation({ summary: 'Foydalanuvchilar ro‘yxati (TEACHER o‘zi yaratganlarini, SA hammasini)' })
  async list(@Query() query: QueryUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.list(query, actor.roles, actor.id);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_READ)
  @ApiOperation({ summary: 'Foydalanuvchi tafsilotlari (TEACHER faqat o‘ziniki)' })
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.findAdminDetail(id, actor.roles, actor.id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi foydalanuvchi yaratish (SUPER_ADMIN: har qanday rol; TEACHER: faqat STUDENT)' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.users.create(
      dto,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_UPDATE)
  @ApiOperation({ summary: 'Foydalanuvchini tahrirlash (TEACHER faqat o‘zi yaratganlarini)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.users.update(
      id,
      dto,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION.USERS_DELETE)
  @ApiOperation({ summary: 'Foydalanuvchini faolsizlantirish (TEACHER faqat o‘zi yaratganlarini)' })
  async deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.users.deactivate(
      id,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }
}
