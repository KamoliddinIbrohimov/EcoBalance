import { createUserSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateUserDto extends createZodDto(createUserSchema) {}
