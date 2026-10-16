import {
  assignmentQuerySchema,
  createAssignmentSchema,
  gradeAssignmentSchema,
  lessonProgressUpdateSchema,
  submitAssignmentSchema,
  updateAssignmentSchema,
} from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateAssignmentDto extends createZodDto(createAssignmentSchema) {}
export class UpdateAssignmentDto extends createZodDto(updateAssignmentSchema) {}
export class SubmitAssignmentDto extends createZodDto(submitAssignmentSchema) {}
export class GradeAssignmentDto extends createZodDto(gradeAssignmentSchema) {}
export class LessonProgressUpdateDto extends createZodDto(lessonProgressUpdateSchema) {}
export class QueryAssignmentDto extends createZodDto(assignmentQuerySchema) {}
