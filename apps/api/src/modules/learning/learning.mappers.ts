import type { Prisma } from '@prisma/client';
import type { AssignmentDto, AssignmentSubmissionDto } from '@eco/shared';

export const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** Egalik va talabaga ko'rinish tekshiruvi uchun group/course ham olinadi. */
export const ASSIGNMENT_SELECT = {
  id: true,
  courseId: true,
  lessonId: true,
  moduleId: true,
  groupId: true,
  createdById: true,
  kind: true,
  titleUz: true,
  descriptionUz: true,
  dueAt: true,
  maxScore: true,
  attachmentKey: true,
  attachmentFileName: true,
  allowLate: true,
  latePenaltyPercent: true,
  startsAt: true,
  endsAt: true,
  timeLimitMinutes: true,
  quizId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { submissions: true } },
  group: { select: { teacherId: true, isActive: true } },
  course: { select: { isPublished: true } },
} satisfies Prisma.AssignmentSelect;

export type AssignmentRow = Prisma.AssignmentGetPayload<{ select: typeof ASSIGNMENT_SELECT }>;

export function toAssignmentDto(r: AssignmentRow): AssignmentDto {
  return {
    id: r.id,
    courseId: r.courseId,
    lessonId: r.lessonId,
    moduleId: r.moduleId,
    groupId: r.groupId,
    createdById: r.createdById,
    kind: r.kind,
    titleUz: r.titleUz,
    descriptionUz: r.descriptionUz,
    dueAt: iso(r.dueAt),
    maxScore: r.maxScore,
    attachmentKey: r.attachmentKey,
    attachmentFileName: r.attachmentFileName,
    allowLate: r.allowLate,
    latePenaltyPercent: r.latePenaltyPercent,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    timeLimitMinutes: r.timeLimitMinutes,
    quizId: r.quizId,
    submissionCount: r._count.submissions,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const SUBMISSION_SELECT = {
  id: true,
  assignmentId: true,
  studentId: true,
  textUz: true,
  fileKey: true,
  fileName: true,
  submittedAt: true,
  score: true,
  feedbackUz: true,
  gradedById: true,
  gradedAt: true,
  status: true,
  attempt: true,
  attemptStartedAt: true,
  attemptDeadline: true,
  isLate: true,
} satisfies Prisma.AssignmentSubmissionSelect;

export type SubmissionRow = Prisma.AssignmentSubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;

export function toSubmissionDto(r: SubmissionRow): AssignmentSubmissionDto {
  return {
    id: r.id,
    assignmentId: r.assignmentId,
    studentId: r.studentId,
    textUz: r.textUz,
    fileKey: r.fileKey,
    fileName: r.fileName,
    submittedAt: r.submittedAt.toISOString(),
    score: r.score,
    feedbackUz: r.feedbackUz,
    gradedById: r.gradedById,
    gradedAt: iso(r.gradedAt),
    status: r.status,
    attempt: r.attempt,
    attemptStartedAt: iso(r.attemptStartedAt),
    attemptDeadline: iso(r.attemptDeadline),
    isLate: r.isLate,
  };
}

/** Qayta topshirishdan oldin joriy urinishning nusxasi (tarix). */
export function revisionOf(s: SubmissionRow): Prisma.AssignmentSubmissionRevisionUncheckedCreateInput {
  return {
    submissionId: s.id,
    attempt: s.attempt,
    textUz: s.textUz,
    fileKey: s.fileKey,
    fileName: s.fileName,
    submittedAt: s.submittedAt,
    score: s.score,
    feedbackUz: s.feedbackUz,
    gradedById: s.gradedById,
    gradedAt: s.gradedAt,
    status: s.status,
  };
}
