import { updateUserSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
