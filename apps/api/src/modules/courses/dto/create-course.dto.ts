import { createCourseSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCourseDto extends createZodDto(createCourseSchema) {}
