import { updateQuizSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateQuizDto extends createZodDto(updateQuizSchema) {}
