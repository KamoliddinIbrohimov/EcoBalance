import { quizQuerySchema, submissionQuerySchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class QueryQuizDto extends createZodDto(quizQuerySchema) {}
export class QuerySubmissionDto extends createZodDto(submissionQuerySchema) {}
