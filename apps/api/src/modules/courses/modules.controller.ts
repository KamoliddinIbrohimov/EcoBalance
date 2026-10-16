import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';
import { createModuleSchema, updateModuleSchema } from '@eco/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
import { ModulesService } from './modules.service';

class CreateModuleDto extends createZodDto(createModuleSchema) {}
class UpdateModuleDto extends createZodDto(updateModuleSchema) {}

@ApiTags('Modules')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
@UseGuards(PermissionsGuard)
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get('courses/:courseId/modules')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kurs modullari ro‘yxati' })
  async list(@Param('courseId', new ParseUUIDPipe()) courseId: string) {
    return this.modules.listByCourse(courseId);
  }

  @Post('modules')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Modul yaratish' })
  async create(@Body() dto: CreateModuleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.modules.create(dto, actor.id, actor.roles);
  }

  @Patch('modules/:id')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Modulni tahrir' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modules.update(id, dto, actor.id, actor.roles);
  }

  @Delete('modules/:id')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({
    summary: 'Modulni o‘chirish (darslar "Umumiy" modulga ko‘chadi, soni qaytariladi)',
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modules.remove(id, actor.id, actor.roles);
  }

  @Get('modules/:id/removal-impact')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Modulni o‘chirish ta‘sir hisoboti (nechta dars ko‘chadi)' })
  async removalImpact(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modules.removalImpact(id, actor.id, actor.roles);
  }

  @Post('modules/backfill')
  @RequirePermissions(PERMISSION.ROLES_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eski kurslarga "Umumiy" modul yaratib, darslarni biriktirish (SA)' })
  async backfill() {
    return this.modules.backfillDefaultModules();
  }
}
