import { createQuestionSchema, reorderQuestionsSchema, updateQuestionSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateQuestionDto extends createZodDto(createQuestionSchema) {}
export class UpdateQuestionDto extends createZodDto(updateQuestionSchema) {}
export class ReorderQuestionsDto extends createZodDto(reorderQuestionsSchema) {}
