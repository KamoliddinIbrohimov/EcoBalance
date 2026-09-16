import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';

import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller({ path: 'roles', version: '1' })
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSION.ROLES_READ)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Rollar ro‘yxati (foydalanuvchiga rol biriktirish uchun)' })
  async list() {
    return this.roles.list();
  }
}
