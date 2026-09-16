import { courseQuerySchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class QueryCourseDto extends createZodDto(courseQuerySchema) {}
