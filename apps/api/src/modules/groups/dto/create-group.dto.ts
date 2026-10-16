import {
  addGroupMemberSchema,
  createGroupSchema,
  groupQuerySchema,
  updateGroupSchema,
} from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateGroupDto extends createZodDto(createGroupSchema) {}
export class UpdateGroupDto extends createZodDto(updateGroupSchema) {}
export class AddGroupMemberDto extends createZodDto(addGroupMemberSchema) {}
export class QueryGroupDto extends createZodDto(groupQuerySchema) {}
