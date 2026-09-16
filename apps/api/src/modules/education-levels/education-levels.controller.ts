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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';
import { createEducationLevelItemSchema, updateEducationLevelItemSchema } from '@eco/shared';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { EducationLevelsService } from './education-levels.service';

class CreateEducationLevelItemDto extends createZodDto(createEducationLevelItemSchema) {}
class UpdateEducationLevelItemDto extends createZodDto(updateEducationLevelItemSchema) {}

@ApiTags('Education Levels')
@ApiBearerAuth('access-token')
@Controller({ path: 'education-levels', version: '1' })
@UseGuards(PermissionsGuard)
export class EducationLevelsController {
  constructor(private readonly service: EducationLevelsService) {}

  @Get()
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Ta‘lim darajalari ro‘yxati (sidebar uchun)' })
  async list() {
    return this.service.list();
  }

  @Post()
  @RequirePermissions(PERMISSION.COURSES_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi ta‘lim darajasi qo‘shish' })
  async create(
    @Body() dto: CreateEducationLevelItemDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.create(dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.COURSES_UPDATE)
  @ApiOperation({ summary: 'Ta‘lim darajasini tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEducationLevelItemDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.update(id, dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.COURSES_DELETE)
  @ApiOperation({ summary: 'Ta‘lim darajasini o‘chirish (built-in emas)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.remove(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}
