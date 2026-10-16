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

  @Post(':id/members/:studentId/transfer')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Talabani boshqa guruhga ko‘chirish' })
  async transferMember(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Body() body: { toGroupId: string },
  ) {
    await this.groups.transferMember(id, studentId, body.toGroupId, {
      id: actor.id,
      roles: actor.roles,
    });
  }

  // ---- Course bindings ----

  @Get(':id/courses')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruhga biriktirilgan kurslar' })
  async listCourseBindings(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.listCourseBindings(id, { id: actor.id, roles: actor.roles });
  }

  @Post(':id/courses/:courseId')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Guruhga kurs biriktirish' })
  async bindCourse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.groups.bindCourse(id, courseId, { id: actor.id, roles: actor.roles });
  }

  @Delete(':id/courses/:courseId')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Guruhdan kursni ajratish' })
  async unbindCourse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    await this.groups.unbindCourse(id, courseId, { id: actor.id, roles: actor.roles });
  }

  // ---- Quiz bindings ----

  @Get(':id/quizzes')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruhga biriktirilgan testlar' })
  async listQuizBindings(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.listQuizBindings(id, { id: actor.id, roles: actor.roles });
  }

  @Post(':id/quizzes/:quizId')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Guruhga test biriktirish (ochilish/maxAttempts/timeLimit sozlamalari bilan)' })
  async bindQuiz(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Body() body: {
      opensAt?: string | null;
      closesAt?: string | null;
      maxAttempts?: number | null;
      timeLimitMinutes?: number | null;
    },
  ) {
    return this.groups.bindQuiz(id, quizId, { id: actor.id, roles: actor.roles }, {
      opensAt: body?.opensAt ? new Date(body.opensAt) : null,
      closesAt: body?.closesAt ? new Date(body.closesAt) : null,
      maxAttempts: body?.maxAttempts ?? null,
      timeLimitMinutes: body?.timeLimitMinutes ?? null,
    });
  }

  @Patch(':id/quizzes/:quizId')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @ApiOperation({ summary: 'Guruh-test biriktirmasi sozlamalarini yangilash' })
  async updateQuizBinding(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Body() body: {
      opensAt?: string | null;
      closesAt?: string | null;
      maxAttempts?: number | null;
      timeLimitMinutes?: number | null;
    },
  ) {
    return this.groups.updateQuizBindingSettings(id, quizId, { id: actor.id, roles: actor.roles }, {
      opensAt: body?.opensAt ? new Date(body.opensAt) : null,
      closesAt: body?.closesAt ? new Date(body.closesAt) : null,
      maxAttempts: body?.maxAttempts ?? null,
      timeLimitMinutes: body?.timeLimitMinutes ?? null,
    });
  }

  @Delete(':id/quizzes/:quizId')
  @RequirePermissions(PERMISSION.GROUPS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Guruhdan testni ajratish' })
  async unbindQuiz(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
  ) {
    await this.groups.unbindQuiz(id, quizId, { id: actor.id, roles: actor.roles });
  }
}
