import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { type CreateModuleInput, type UpdateModuleInput, createModuleSchema, updateModuleSchema } from '@eco/shared';

import { ZBody } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { ModulesService } from './modules.service';

@Controller()
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get('courses/:courseId/modules')
  list(@Param('courseId', ParseUUIDPipe) courseId: string, @CurrentActor() actor: Actor) {
    return this.modules.listByCourse(courseId, actor);
  }

  @Post('modules')
  @Roles('SUPER_ADMIN', 'TEACHER')
  create(@ZBody(createModuleSchema) body: CreateModuleInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.modules.create(body, actor, client);
  }

  @Patch('modules/:id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateModuleSchema) body: UpdateModuleInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.modules.update(id, body, actor, client);
  }

  @Delete('modules/:id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.modules.remove(id, actor, client);
  }
}
