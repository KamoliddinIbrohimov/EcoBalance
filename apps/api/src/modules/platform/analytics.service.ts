import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.service';
import { HIGHER_EDUCATION } from '../courses/course-access.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SA dashboard statistikasi. Faqat oliy ta'lim kurslari sanaladi (boshqa darajadagi
 * eski kurslar yashirin); arxivlangan (soft-delete) darslar hisobga olinmaydi.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const course = { educationLevel: HIGHER_EDUCATION };
    const liveLesson = { archivedAt: null, course };
    const [
      users,
      organizations,
      courses,
      lessons,
      ecoReports,
      levels,
      materials,
      materialsSize,
      usersByRole,
      orgsByType,
      coursesByLevel,
      lessonsByType,
      ecoByCategory,
      ecoByStatus,
      recentUsers,
      lessonsByLevel,
      materialsByLevel,
      roles,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.course.count({ where: course }),
      this.prisma.lesson.count({ where: liveLesson }),
      this.prisma.ecoReport.count(),
      this.prisma.educationLevelItem.count({ where: { slug: HIGHER_EDUCATION } }),
      this.prisma.courseMaterial.count({ where: { course } }),
      this.prisma.courseMaterial.aggregate({ where: { course }, _sum: { sizeBytes: true } }),
      this.prisma.userRole.groupBy({ by: ['roleId'], _count: { _all: true } }),
      this.prisma.organization.groupBy({ by: ['type'], _count: { _all: true }, orderBy: { type: 'asc' } }),
      this.prisma.course.groupBy({
        by: ['educationLevel'],
        where: course,
        _count: { _all: true },
        orderBy: { educationLevel: 'asc' },
      }),
      this.prisma.lesson.groupBy({
        by: ['lessonType'],
        where: liveLesson,
        _count: { _all: true },
        orderBy: { lessonType: 'asc' },
      }),
      this.prisma.ecoReport.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { category: 'asc' } }),
      this.prisma.ecoReport.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) } },
        select: { createdAt: true },
      }),
      this.prisma.$queryRaw<Array<{ level: string; count: bigint }>>`
        SELECT c.education_level AS level, COUNT(l.id)::bigint AS count
        FROM lessons l JOIN courses c ON c.id = l.course_id
        WHERE l.archived_at IS NULL AND c.education_level = ${HIGHER_EDUCATION}
        GROUP BY c.education_level ORDER BY c.education_level`,
      this.prisma.$queryRaw<Array<{ level: string; count: bigint }>>`
        SELECT c.education_level AS level, COUNT(m.id)::bigint AS count
        FROM course_materials m JOIN courses c ON c.id = m.course_id
        WHERE c.education_level = ${HIGHER_EDUCATION}
        GROUP BY c.education_level ORDER BY c.education_level`,
      this.prisma.role.findMany({ select: { id: true, slug: true } }),
    ]);

    const roleSlug = new Map(roles.map((r) => [r.id, r.slug as string]));
    return {
      totals: {
        users,
        organizations,
        courses,
        lessons,
        ecoReports,
        levels,
        materials,
        materialsSizeBytes: materialsSize._sum.sizeBytes ?? 0,
      },
      usersByRole: usersByRole.map((r) => ({ role: roleSlug.get(r.roleId) ?? 'UNKNOWN', count: r._count._all })),
      orgsByType: orgsByType.map((r) => ({ type: r.type, count: r._count._all })),
      coursesByLevel: coursesByLevel.map((r) => ({ level: r.educationLevel, count: r._count._all })),
      lessonsByLevel: lessonsByLevel.map((r) => ({ level: r.level, count: Number(r.count) })),
      lessonsByType: lessonsByType.map((r) => ({ type: r.lessonType, count: r._count._all })),
      materialsByLevel: materialsByLevel.map((r) => ({ level: r.level, count: Number(r.count) })),
      registrationsLast30Days: this.byDay(recentUsers.map((u) => u.createdAt)),
      ecoReportsByCategory: ecoByCategory.map((r) => ({ category: r.category, count: r._count._all })),
      ecoReportsByStatus: ecoByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    };
  }

  async recentAudit(limit: number) {
    const rows = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      userName: r.user ? `${r.user.firstName} ${r.user.lastName}` : null,
      userEmail: r.user?.email ?? null,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Oxirgi 30 kun (UTC), bo'sh kunlar 0 bilan. */
  private byDay(dates: Date[]) {
    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) buckets.set(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10), 0);
    for (const d of dates) {
      const key = d.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
    }
    return [...buckets].map(([date, count]) => ({ date, count }));
  }
}
