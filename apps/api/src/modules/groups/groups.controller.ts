import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type AddGroupMemberInput,
  type CreateGroupInput,
  type GroupQuery,
  type UpdateGroupInput,
  addGroupMemberSchema,
  createGroupSchema,
  groupQuerySchema,
  updateGroupSchema,
} from '@eco/shared';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { GroupsService } from './groups.service';
import { MembersService } from './members.service';

const Id = (name = 'id') => Param(name, ParseUUIDPipe);

@Controller('groups')
@Roles('SUPER_ADMIN', 'TEACHER')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly members: MembersService,
  ) {}

  @Get()
  list(@ZQuery(groupQuerySchema) q: GroupQuery, @CurrentActor() actor: Actor) {
    return this.groups.list(q, actor);
  }

  @Get(':id')
  detail(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.groups.detail(id, actor);
  }

  @Post()
  create(@ZBody(createGroupSchema) body: CreateGroupInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.groups.create(body, actor, client);
  }

  @Patch(':id')
  update(
    @Id() id: string,
    @ZBody(updateGroupSchema) body: UpdateGroupInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.groups.update(id, body, actor, client);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Id() id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    await this.groups.remove(id, actor, client);
  }

  // ---- A'zolar ----

  @Get(':id/members')
  listMembers(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.members.list(id, actor);
  }

  @Post(':id/members')
  addMember(
    @Id() id: string,
    @ZBody(addGroupMemberSchema) body: AddGroupMemberInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.members.add(id, body.studentId, actor, client);
  }

  @Delete(':id/members/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Id() id: string,
    @Id('studentId') studentId: string,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    await this.members.remove(id, studentId, actor, client);
  }
}
