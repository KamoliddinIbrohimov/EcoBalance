import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type CreateUserInput,
  type UpdateUserInput,
  type UserQuery,
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
} from '@eco/shared';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { UsersService } from './users.service';

@Controller('users')
@Roles('SUPER_ADMIN', 'TEACHER')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@ZQuery(userQuerySchema) q: UserQuery, @CurrentActor() actor: Actor) {
    return this.users.list(q, actor);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.users.detail(id, actor);
  }

  @Post()
  create(@ZBody(createUserSchema) body: CreateUserInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.users.create(body, actor, client);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateUserSchema) body: UpdateUserInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.users.update(id, body, actor, client);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.users.deactivate(id, actor, client);
  }
}

@Controller('roles')
@Roles('SUPER_ADMIN', 'TEACHER')
export class RolesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.roles();
  }
}
