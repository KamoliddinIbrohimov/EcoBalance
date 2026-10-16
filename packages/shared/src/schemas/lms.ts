import { z } from 'zod';

import { paginationQuerySchema } from './pagination';

// ---------------------------------------------------------------
// Group
// ---------------------------------------------------------------

export const groupSchema = z.object({
  id: z.string().uuid(),
  nameUz: z.string(),
  descriptionUz: z.string().nullable(),
  teacherId: z.string().uuid(),
  isActive: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GroupDto = z.infer<typeof groupSchema>;

export const groupWithTeacherSchema = groupSchema.extend({
  teacher: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }),
});
export type GroupWithTeacherDto = z.infer<typeof groupWithTeacherSchema>;

export const createGroupSchema = z.object({
  nameUz: z.string().trim().min(2).max(255),
  descriptionUz: z.string().max(4000).nullable().optional(),
  /** faqat SUPER_ADMIN uchun; TEACHER o'ziga bog'laydi. */
  teacherId: z.string().uuid().optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  nameUz: z.string().trim().min(2).max(255).optional(),
  descriptionUz: z.string().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addGroupMemberSchema = z.object({
  studentId: z.string().uuid(),
});
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

export const groupMemberSchema = z.object({
  groupId: z.string().uuid(),
  studentId: z.string().uuid(),
  joinedAt: z.string().datetime(),
  student: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    isActive: z.boolean(),
  }),
});
export type GroupMemberDto = z.infer<typeof groupMemberSchema>;

export const groupQuerySchema = paginationQuerySchema.extend({
  teacherId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});
export type GroupQuery = z.infer<typeof groupQuerySchema>;

// ---------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------

export const ASSIGNMENT_STATUS = {
  SUBMITTED: 'SUBMITTED',
  GRADED: 'GRADED',
  RETURNED: 'RETURNED',
} as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

export const assignmentSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid().nullable(),
  lessonId: z.string().uuid().nullable(),
  groupId: z.string().uuid(),
  createdById: z.string().uuid(),
  titleUz: z.string(),
  descriptionUz: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  maxScore: z.number().int().positive(),
  attachmentKey: z.string().nullable(),
  submissionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssignmentDto = z.infer<typeof assignmentSchema>;

export const createAssignmentSchema = z.object({
  groupId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  titleUz: z.string().trim().min(2).max(255),
  descriptionUz: z.string().max(10000).nullable().optional(),
  dueAt: z.coerce.date().optional().nullable(),
  maxScore: z.coerce.number().int().min(1).max(1000).default(100),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = createAssignmentSchema.partial().omit({ groupId: true });
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const submitAssignmentSchema = z.object({
  textUz: z.string().max(10000).optional(),
});
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

export const gradeAssignmentSchema = z.object({
  score: z.coerce.number().int().min(0),
  feedbackUz: z.string().max(5000).optional(),
  status: z
    .enum([ASSIGNMENT_STATUS.GRADED, ASSIGNMENT_STATUS.RETURNED])
    .default(ASSIGNMENT_STATUS.GRADED),
});
export type GradeAssignmentInput = z.infer<typeof gradeAssignmentSchema>;

export const assignmentSubmissionSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  textUz: z.string().nullable(),
  fileKey: z.string().nullable(),
  fileName: z.string().nullable(),
  submittedAt: z.string().datetime(),
  score: z.number().int().nullable(),
  feedbackUz: z.string().nullable(),
  gradedById: z.string().uuid().nullable(),
  gradedAt: z.string().datetime().nullable(),
  status: z.nativeEnum(ASSIGNMENT_STATUS),
});
export type AssignmentSubmissionDto = z.infer<typeof assignmentSubmissionSchema>;

export const assignmentSubmissionWithStudentSchema = assignmentSubmissionSchema.extend({
  student: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }),
});
export type AssignmentSubmissionWithStudentDto = z.infer<typeof assignmentSubmissionWithStudentSchema>;

export const assignmentQuerySchema = paginationQuerySchema.extend({
  groupId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
});
export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;

// ---------------------------------------------------------------
// LessonProgress
// ---------------------------------------------------------------

export const lessonProgressSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  completedAt: z.string().datetime().nullable(),
  lastViewedAt: z.string().datetime(),
});
export type LessonProgressDto = z.infer<typeof lessonProgressSchema>;

export const lessonProgressUpdateSchema = z.object({
  completed: z.boolean().default(false),
});
export type LessonProgressUpdateInput = z.infer<typeof lessonProgressUpdateSchema>;

// ---------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------

export const studentStatsSchema = z.object({
  studentId: z.string().uuid(),
  lessonsTotal: z.number().int().nonnegative(),
  lessonsCompleted: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  quizzesTaken: z.number().int().nonnegative(),
  quizzesPassed: z.number().int().nonnegative(),
  quizzesAverageScore: z.number().min(0).max(100).nullable(),
  assignmentsSubmitted: z.number().int().nonnegative(),
  assignmentsGraded: z.number().int().nonnegative(),
  /** O'rtacha ball — 0..100 foiz (score/maxScore). Xom ball emas. */
  assignmentsAverageScore: z.number().min(0).max(100).nullable(),
  lastActivityAt: z.string().datetime().nullable(),
});
export type StudentStatsDto = z.infer<typeof studentStatsSchema>;

export const groupStatsSchema = z.object({
  groupId: z.string().uuid(),
  studentCount: z.number().int().nonnegative(),
  avgProgressPercent: z.number().min(0).max(100),
  avgQuizScore: z.number().min(0).max(100).nullable(),
  pendingSubmissions: z.number().int().nonnegative(),
});
export type GroupStatsDto = z.infer<typeof groupStatsSchema>;
