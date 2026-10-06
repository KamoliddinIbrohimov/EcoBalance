import { submitQuizSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class SubmitQuizDto extends createZodDto(submitQuizSchema) {}
