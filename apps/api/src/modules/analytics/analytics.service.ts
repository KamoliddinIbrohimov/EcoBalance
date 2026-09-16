import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface OverviewDto {
  totals: {
    users: number;
    organizations: number;
    courses: number;
    lessons: number;
    ecoReports: number;
    /** Ta'lim darajalari soni (education_level_items). */
    levels: number;
    /** Barcha kurslardagi materiallar soni. */
    materials: number;
    /** Materiallar umumiy hajmi baytlarda (MinIO'dagi fayl hajmi). */
    materialsSizeBytes: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  orgsByType: Array<{ type: string; count: number }>;
  coursesByLevel: Array<{ level: string; count: number }>;
  /** Ta'lim darajasi bo'yicha darslar (level slug → dars soni). */
  lessonsByLevel: Array<{ level: string; count: number }>;
  /** Dars turi bo'yicha (AMALIY / LABORATORIYA / EKSKURSIYA). */
  lessonsByType: Array<{ type: string; count: number }>;
  /** Materiallar — ta'lim darajasi bo'yicha (fayl soni). */
  materialsByLevel: Array<{ level: string; count: number }>;
  registrationsLast30Days: Array<{ date: string; count: number }>;
  ecoReportsByCategory: Array<{ category: string; count: number }>;
  ecoReportsByStatus: Array<{ status: string; count: number }>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<OverviewDto> {
    const [
      users,
      organizations,
      courses,
      lessons,
      ecoReports,
      levels,
      materials,
      materialsSizeAgg,
      usersByRoleRaw,
      orgsByTypeRaw,
      coursesByLevelRaw,
      lessonsByTypeRaw,
      ecoByCatRaw,
      ecoByStatusRaw,
      recentUsers,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.course.count(),
      this.prisma.lesson.count(),
      this.prisma.ecoReport.count(),
      this.prisma.educationLevelItem.count(),
      this.prisma.courseMaterial.count(),
      this.prisma.courseMaterial.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.userRole.groupBy({
        by: ['roleId'],
        _count: { _all: true },
        orderBy: { roleId: 'asc' },
      }),
      this.prisma.organization.groupBy({
        by: ['type'],
        _count: { _all: true },
        orderBy: { type: 'asc' },
      }),
      this.prisma.course.groupBy({
        by: ['educationLevel'],
        _count: { _all: true },
        orderBy: { educationLevel: 'asc' },
      }),
      this.prisma.lesson.groupBy({
        by: ['lessonType'],
        _count: { _all: true },
        orderBy: { lessonType: 'asc' },
      }),
      this.prisma.ecoReport.groupBy({
        by: ['category'],
        _count: { _all: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.ecoReport.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.user.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Lessons va materials — daraja bo'yicha jamlash (course.educationLevel orqali)
    const [lessonsByLevelRaw, materialsByLevelRaw] = await Promise.all([
      this.prisma.$queryRaw<Array<{ education_level: string; count: bigint }>>`
        SELECT c.education_level, COUNT(l.id)::bigint AS count
        FROM lessons l
        JOIN courses c ON c.id = l.course_id
        GROUP BY c.education_level
        ORDER BY c.education_level
      `,
      this.prisma.$queryRaw<Array<{ education_level: string; count: bigint }>>`
        SELECT c.education_level, COUNT(m.id)::bigint AS count
        FROM course_materials m
        JOIN courses c ON c.id = m.course_id
        GROUP BY c.education_level
        ORDER BY c.education_level
      `,
    ]);

    // roleId → slug uchun qo'shimcha so'rov
    const roles = await this.prisma.role.findMany({ select: { id: true, slug: true } });
    const roleIdToSlug = new Map(roles.map((r) => [r.id, r.slug as string]));

    const registrationsLast30Days = this.groupByDay(recentUsers.map((u) => u.createdAt));

    return {
      totals: {
        users,
        organizations,
        courses,
        lessons,
        ecoReports,
        levels,
        materials,
        materialsSizeBytes: materialsSizeAgg._sum.sizeBytes ?? 0,
      },
      usersByRole: usersByRoleRaw.map((r) => ({
        role: roleIdToSlug.get(r.roleId) ?? 'UNKNOWN',
        count: (r._count as { _all: number })._all,
      })),
      orgsByType: orgsByTypeRaw.map((r) => ({
        type: r.type,
        count: (r._count as { _all: number })._all,
      })),
      coursesByLevel: coursesByLevelRaw.map((r) => ({
        level: r.educationLevel,
        count: (r._count as { _all: number })._all,
      })),
      lessonsByLevel: lessonsByLevelRaw.map((r) => ({
        level: r.education_level,
        count: Number(r.count),
      })),
      lessonsByType: lessonsByTypeRaw.map((r) => ({
        type: r.lessonType,
        count: (r._count as { _all: number })._all,
      })),
      materialsByLevel: materialsByLevelRaw.map((r) => ({
        level: r.education_level,
        count: Number(r.count),
      })),
      registrationsLast30Days,
      ecoReportsByCategory: ecoByCatRaw.map((r) => ({
        category: r.category,
        count: (r._count as { _all: number })._all,
      })),
      ecoReportsByStatus: ecoByStatusRaw.map((r) => ({
        status: r.status,
        count: (r._count as { _all: number })._all,
      })),
    };
  }

  /**
   * Audit log so'nggi yozuvlari — Dashboard uchun.
   */
  async recentAuditLogs(limit = 20) {
    const rows = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
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

  private groupByDay(dates: Date[]) {
    const buckets = new Map<string, number>();
    // 30 kunlik bo'sh bucket'lar yaratamiz
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const d of dates) {
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([date, count]) => ({ date, count }));
  }
}
