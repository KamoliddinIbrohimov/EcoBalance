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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@Controller({ path: 'organizations', version: '1' })
@UseGuards(PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions(PERMISSION.ORGS_READ)
  @ApiOperation({ summary: 'Tashkilotlar ro‘yxati (sahifalash, qidiruv, filtr)' })
  async list(@Query() query: QueryOrganizationDto) {
    return this.organizations.list(query);
  }

  // NOTE: must be registered before ':id' so Nest/Express doesn't treat
  // "tree" as an :id path param.
  @Get('tree')
  @RequirePermissions(PERMISSION.ORGS_READ)
  @ApiOperation({ summary: 'Tashkilotlar ierarxiyasi (shahar → tuman → mahalla/maktab...)' })
  async tree() {
    return this.organizations.tree();
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.ORGS_READ)
  @ApiOperation({ summary: 'Tashkilot tafsilotlari' })
  async detail(@Param('id') id: string) {
    return this.organizations.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSION.ORGS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi tashkilot yaratish' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.organizations.create(dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.ORGS_UPDATE)
  @ApiOperation({ summary: 'Tashkilot ma’lumotlarini tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.organizations.update(id, dto, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.ORGS_DELETE)
  @ApiOperation({ summary: 'Tashkilotni o‘chirish (faqat bo‘sh — foydalanuvchi/quyi tashkiloti yo‘q)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.organizations.remove(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}
