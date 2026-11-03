import { Module } from '@nestjs/common';

import { BindingsService } from './bindings.service';
import { GroupAccess } from './group-access.service';
import { GroupContentController } from './group-content.controller';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { MembersService } from './members.service';
import { ReleasesService } from './releases.service';
import { StudentGroupService } from './release-policy';

/** `StudentGroupService` — talabaning guruhi va dars ochilishi (courses/learning uchun). */
@Module({
  controllers: [GroupsController, GroupContentController],
  providers: [GroupAccess, GroupsService, MembersService, BindingsService, ReleasesService, StudentGroupService],
  exports: [StudentGroupService, GroupAccess],
})
export class GroupsModule {}
