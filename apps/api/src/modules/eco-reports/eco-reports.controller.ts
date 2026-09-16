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
import {
  createEcoReportSchema,
  ecoReportQuerySchema,
  updateEcoReportStatusSchema,
} from '@eco/shared';
import { createZodDto } from 'nestjs-zod';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { EcoReportsService } from './eco-reports.service';

class CreateEcoReportDto extends createZodDto(createEcoReportSchema) {}
class UpdateEcoReportStatusDto extends createZodDto(updateEcoReportStatusSchema) {}
class QueryEcoReportsDto extends createZodDto(ecoReportQuerySchema) {}

@ApiTags('Eco Reports (EKO-PATRUL)')
@ApiBearerAuth('access-token')
@Controller({ path: 'eco-reports', version: '1' })
@UseGuards(PermissionsGuard)
export class EcoReportsController {
  constructor(private readonly service: EcoReportsService) {}

  @Get()
  @RequirePermissions(PERMISSION.ECO_REPORTS_READ)
  @ApiOperation({ summary: 'Ekologik murojaatlar ro‘yxati' })
  async list(@Query() query: QueryEcoReportsDto) {
    return this.service.list(query);
  }

  @Get('stats')
  @RequirePermissions(PERMISSION.ECO_REPORTS_READ)
  @ApiOperation({ summary: 'Ekologik murojaatlar statistikasi (toifa/status)' })
  async stats() {
    return this.service.stats();
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.ECO_REPORTS_READ)
  @ApiOperation({ summary: 'Murojaat tafsilotlari' })
  async detail(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSION.ECO_REPORTS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi ekologik murojaat yaratish' })
  async create(
    @Body() dto: CreateEcoReportDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.create(dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSION.ECO_REPORTS_MANAGE)
  @ApiOperation({ summary: 'Murojaat holatini o‘zgartirish' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEcoReportStatusDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.updateStatus(id, dto, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.ECO_REPORTS_MANAGE)
  @ApiOperation({ summary: 'Murojaatni o‘chirish (idempotent)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.remove(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}
