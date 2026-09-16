import { updateCourseSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateCourseDto extends createZodDto(updateCourseSchema) {}
