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
  PENDING_REVIEW: 'PENDING_REVIEW',
} as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

export const ASSIGNMENT_KIND = {
  TASK: 'TASK',
  TIMED: 'TIMED',
  QUESTIONNAIRE: 'QUESTIONNAIRE',
} as const;
export type AssignmentKind = (typeof ASSIGNMENT_KIND)[keyof typeof ASSIGNMENT_KIND];

export const CONTENT_VISIBILITY = {
  PRIVATE: 'PRIVATE',
  LIBRARY: 'LIBRARY',
} as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITY)[keyof typeof CONTENT_VISIBILITY];

export const assignmentSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid().nullable(),
  lessonId: z.string().uuid().nullable(),
  moduleId: z.string().uuid().nullable(),
  groupId: z.string().uuid(),
  createdById: z.string().uuid(),
  kind: z.nativeEnum(ASSIGNMENT_KIND),
  titleUz: z.string(),
  descriptionUz: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  maxScore: z.number().int().positive(),
  attachmentKey: z.string().nullable(),
  attachmentFileName: z.string().nullable(),
  allowLate: z.boolean(),
  latePenaltyPercent: z.number().int().min(0).max(100),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  timeLimitMinutes: z.number().int().nullable(),
  quizId: z.string().uuid().nullable(),
  submissionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssignmentDto = z.infer<typeof assignmentSchema>;

export const createAssignmentSchema = z.object({
  groupId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  kind: z.nativeEnum(ASSIGNMENT_KIND).default(ASSIGNMENT_KIND.TASK),
  titleUz: z.string().trim().min(2).max(255),
  descriptionUz: z.string().max(10000).nullable().optional(),
  dueAt: z.coerce.date().optional().nullable(),
  maxScore: z.coerce.number().int().min(1).max(1000).default(100),
  // TASK siyosati
  allowLate: z.boolean().default(false),
  latePenaltyPercent: z.coerce.number().int().min(0).max(100).default(0),
  // TIMED
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(480).optional().nullable(),
  // QUESTIONNAIRE
  quizId: z.string().uuid().optional().nullable(),
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

export const reopenSubmissionSchema = z.object({
  feedbackUz: z.string().max(5000).optional(),
});
export type ReopenSubmissionInput = z.infer<typeof reopenSubmissionSchema>;

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
  attempt: z.number().int().positive(),
  attemptStartedAt: z.string().datetime().nullable(),
  attemptDeadline: z.string().datetime().nullable(),
  isLate: z.boolean(),
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
  moduleId: z.string().uuid().optional(),
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
// F3 (2.A): Module + GroupLessonRelease
// ---------------------------------------------------------------

export const moduleSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  titleUz: z.string(),
  descriptionUz: z.string().nullable(),
  isPublished: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ModuleDto = z.infer<typeof moduleSchema>;

export const createModuleSchema = z.object({
  courseId: z.string().uuid(),
  titleUz: z.string().trim().min(2).max(255),
  descriptionUz: z.string().max(4000).nullable().optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  isPublished: z.boolean().default(true),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = createModuleSchema
  .partial()
  .omit({ courseId: true });
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

export const GROUP_LESSON_RELEASE_STATUS = {
  LOCKED: 'LOCKED',
  SCHEDULED: 'SCHEDULED',
  OPEN: 'OPEN',
} as const;
export type GroupLessonReleaseStatus =
  (typeof GROUP_LESSON_RELEASE_STATUS)[keyof typeof GROUP_LESSON_RELEASE_STATUS];

export const groupLessonReleaseSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  lessonId: z.string().uuid().nullable(),
  moduleId: z.string().uuid().nullable(),
  opensAt: z.string().datetime().nullable(),
  closesAt: z.string().datetime().nullable(),
  status: z.nativeEnum(GROUP_LESSON_RELEASE_STATUS),
});
export type GroupLessonReleaseDto = z.infer<typeof groupLessonReleaseSchema>;

export const upsertReleaseSchema = z
  .object({
    lessonId: z.string().uuid().optional(),
    moduleId: z.string().uuid().optional(),
    opensAt: z.coerce.date().optional().nullable(),
    closesAt: z.coerce.date().optional().nullable(),
    status: z.nativeEnum(GROUP_LESSON_RELEASE_STATUS).default(GROUP_LESSON_RELEASE_STATUS.LOCKED),
  })
  .refine((v) => !!v.lessonId !== !!v.moduleId, {
    message: 'lessonId yoki moduleId — birini belgilang',
  });
export type UpsertReleaseInput = z.infer<typeof upsertReleaseSchema>;

export const reorderLessonsSchema = z.object({
  lessonIds: z.array(z.string().uuid()).min(1),
});
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;

export const bindQuizSettingsSchema = z.object({
  opensAt: z.coerce.date().optional().nullable(),
  closesAt: z.coerce.date().optional().nullable(),
  maxAttempts: z.coerce.number().int().min(1).max(50).optional().nullable(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(480).optional().nullable(),
});
export type BindQuizSettingsInput = z.infer<typeof bindQuizSettingsSchema>;

export const transferMemberSchema = z.object({
  toGroupId: z.string().uuid(),
});
export type TransferMemberInput = z.infer<typeof transferMemberSchema>;

export const heartbeatSchema = z.object({
  activeSeconds: z.coerce.number().int().min(0).max(90),
  position: z.coerce.number().int().min(0).max(100).optional(),
});
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

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
