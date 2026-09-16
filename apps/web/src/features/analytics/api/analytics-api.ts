import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

export interface OverviewDto {
  totals: {
    users: number;
    organizations: number;
    courses: number;
    lessons: number;
    ecoReports: number;
    levels: number;
    materials: number;
    materialsSizeBytes: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  orgsByType: Array<{ type: string; count: number }>;
  coursesByLevel: Array<{ level: string; count: number }>;
  lessonsByLevel: Array<{ level: string; count: number }>;
  lessonsByType: Array<{ type: string; count: number }>;
  materialsByLevel: Array<{ level: string; count: number }>;
  registrationsLast30Days: Array<{ date: string; count: number }>;
  ecoReportsByCategory: Array<{ category: string; count: number }>;
  ecoReportsByStatus: Array<{ status: string; count: number }>;
}

export interface AuditLogRow {
  id: string;
  action: string;
  subjectType: string | null;
  subjectId: string | null;
  userName: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export const analyticsApi = {
  async overview(): Promise<OverviewDto> {
    const { data } = await apiClient.get<Envelope<OverviewDto>>('/analytics/overview');
    return data.data;
  },
  async recentAudit(limit = 20): Promise<AuditLogRow[]> {
    const { data } = await apiClient.get<Envelope<AuditLogRow[]>>(
      `/analytics/audit-recent?limit=${limit}`,
    );
    return data.data;
  },
};
