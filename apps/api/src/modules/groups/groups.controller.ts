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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
import {
  AddGroupMemberDto,
  CreateGroupDto,
  QueryGroupDto,
  UpdateGroupDto,
} from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('Groups')
@ApiBearerAuth('access-token')
@Controller({ path: 'groups', version: '1' })
@UseGuards(PermissionsGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruhlar ro‘yxati (TEACHER o‘ziniki, SA hammasi)' })
  async list(@CurrentUser() actor: AuthenticatedUser, @Query() query: QueryGroupDto) {
    return this.groups.list(query, { id: actor.id, roles: actor.roles });
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruh tafsilotlari' })
  async detail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.detail(id, { id: actor.id, roles: actor.roles });
  }

  @Post()
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi guruh yaratish' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groups.create(dto, { id: actor.id, roles: actor.roles });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruhni tahrirlash' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(id, dto, { id: actor.id, roles: actor.roles });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Guruhni o‘chirish' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.groups.remove(id, { id: actor.id, roles: actor.roles });
  }

  // ---- Members ----

  @Get(':id/members')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruh a‘zolari ro‘yxati' })
  async members(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.listMembers(id, { id: actor.id, roles: actor.roles });
  }

  @Post(':id/members')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Guruhga talaba qo‘shish' })
  async addMember(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groups.addMember(id, dto, { id: actor.id, roles: actor.roles });
  }

  @Delete(':id/members/:studentId')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Guruhdan talabani chiqarish' })
  async removeMember(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    await this.groups.removeMember(id, studentId, { id: actor.id, roles: actor.roles });
  }
}
