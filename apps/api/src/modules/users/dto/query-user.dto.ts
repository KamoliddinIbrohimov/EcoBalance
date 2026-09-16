import { userQuerySchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class QueryUserDto extends createZodDto(userQuerySchema) {}
