import { createLessonSchema, updateLessonSchema, lessonQuerySchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateLessonDto extends createZodDto(createLessonSchema) {}
export class UpdateLessonDto extends createZodDto(updateLessonSchema) {}
export class QueryLessonDto extends createZodDto(lessonQuerySchema) {}
