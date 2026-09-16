import type {
  CreateEcoReportInput,
  EcoReportDto,
  EcoReportQuery,
  UpdateEcoReportStatusInput,
} from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface EcoStats {
  total: number;
  byCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

export const ecoReportsApi = {
  async list(query: Partial<EcoReportQuery> = {}): Promise<Paginated<EcoReportDto>> {
    const { data } = await apiClient.get<Paginated<EcoReportDto>>('/eco-reports', {
      params: query,
    });
    return data;
  },
  async create(input: CreateEcoReportInput): Promise<EcoReportDto> {
    const { data } = await apiClient.post<Envelope<EcoReportDto>>('/eco-reports', input);
    return data.data;
  },
  async updateStatus(
    id: string,
    input: UpdateEcoReportStatusInput,
  ): Promise<EcoReportDto> {
    const { data } = await apiClient.patch<Envelope<EcoReportDto>>(
      `/eco-reports/${id}/status`,
      input,
    );
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/eco-reports/${id}`);
  },
  async stats(): Promise<EcoStats> {
    const { data } = await apiClient.get<Envelope<EcoStats>>('/eco-reports/stats');
    return data.data;
  },
};
