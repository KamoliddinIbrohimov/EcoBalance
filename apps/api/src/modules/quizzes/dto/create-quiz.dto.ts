import { createQuizSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateQuizDto extends createZodDto(createQuizSchema) {}
