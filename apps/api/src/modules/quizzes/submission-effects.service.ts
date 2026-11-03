import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.service';
import type { SubmissionRow } from './quiz.mapper';

interface SubmitContext {
  quiz: { id: string; titleUz: string; ownerId: string | null };
  submission: SubmissionRow;
  groupId: string;
  teacherId: string;
}

/**
 * Topshirishdan keyingi ikkilamchi ishlar. Ular hech qachon talabaning
 * muvaffaqiyatli topshirishini yiqitmaydi — xato faqat loglanadi.
 */
@Injectable()
export class SubmissionEffectsService {
  private readonly logger = new Logger(SubmissionEffectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async afterSubmit(ctx: SubmitContext) {
    await Promise.all([
      this.notify(ctx).catch((err) => this.logger.error({ err, submissionId: ctx.submission.id }, 'QUIZ_SUBMITTED yuborilmadi')),
      this.syncQuestionnaires(ctx).catch((err) =>
        this.logger.error({ err, submissionId: ctx.submission.id }, 'QUESTIONNAIRE baholanmadi'),
      ),
    ]);
  }

  /** SA'larga, guruh o'qituvchisiga va test egasiga (takrorsiz). */
  private async notify({ quiz, submission, teacherId }: SubmitContext) {
    const [student, admins] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: submission.userId }, select: { firstName: true, lastName: true } }),
      this.prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: { slug: 'SUPER_ADMIN' } } } },
        select: { id: true },
      }),
    ]);
    const name = student ? `${student.firstName} ${student.lastName}`.trim() : 'Foydalanuvchi';
    const body = [`${name} «${quiz.titleUz}» testini topshirdi.`];
    if (submission.scorePercent !== null) {
      body.push(`Natija: ${submission.scorePercent}% (${submission.scoreTotal}/${submission.scoreMax}).`);
    }
    const base = {
      type: 'QUIZ_SUBMITTED',
      bodyUz: body.join(' '),
      data: {
        submissionId: submission.id,
        quizId: submission.quizId,
        userId: submission.userId,
        scorePercent: submission.scorePercent,
      },
    };
    const adminIds = new Set(admins.map((a) => a.id));
    const others = new Set([teacherId, quiz.ownerId].filter((id): id is string => !!id && !adminIds.has(id)));
    await this.prisma.notification.createMany({
      data: [
        ...[...adminIds].map((userId) => ({ ...base, userId, titleUz: 'Yangi test topshirildi' })),
        ...[...others].map((userId) => ({ ...base, userId, titleUz: 'Guruhingiz talabasi test topshirdi' })),
      ],
    });
  }

  /**
   * Shu testga bog'langan, talaba guruhidagi QUESTIONNAIRE topshiriqlarga
   * avto-baho: score = scorePercent × maxScore / 100 (oxirgi urinish yutadi).
   * Faqat Likert (ballsiz) so'rovnoma — baho qo'yilmaydi, faqat "topshirildi".
   */
  private async syncQuestionnaires({ quiz, submission, groupId }: SubmitContext) {
    const assignments = await this.prisma.assignment.findMany({
      where: { kind: 'QUESTIONNAIRE', quizId: quiz.id, groupId },
      select: { id: true, maxScore: true },
    });
    const now = new Date();
    const percent = submission.scorePercent;
    for (const a of assignments) {
      const key = { assignmentId_studentId: { assignmentId: a.id, studentId: submission.userId } };
      if (percent === null) {
        await this.prisma.assignmentSubmission.upsert({
          where: key,
          create: { assignmentId: a.id, studentId: submission.userId, submittedAt: now, status: 'SUBMITTED' },
          update: {},
        });
        continue;
      }
      const graded = { score: Math.round((percent / 100) * a.maxScore), gradedAt: now, submittedAt: now, status: 'GRADED' as const };
      await this.prisma.assignmentSubmission.upsert({
        where: key,
        create: { assignmentId: a.id, studentId: submission.userId, attempt: 1, ...graded },
        update: graded,
      });
    }
  }
}
