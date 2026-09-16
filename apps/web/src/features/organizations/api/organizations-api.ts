import type {
  AdminOrganizationDto,
  CreateOrganizationInput,
  OrganizationQuery,
  OrganizationTreeNode,
  UpdateOrganizationInput,
} from '@eco/shared';

import type { PaginatedResult } from '@/features/users/api/users-api';
import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

function toQueryParams(
  query: Partial<OrganizationQuery>,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params[key] = value as string | number | boolean;
  }
  return params;
}

export const organizationsApi = {
  async list(query: Partial<OrganizationQuery>): Promise<PaginatedResult<AdminOrganizationDto>> {
    const { data } = await apiClient.get<PaginatedResult<AdminOrganizationDto>>('/organizations', {
      params: toQueryParams(query),
    });
    return data;
  },

  async tree(): Promise<OrganizationTreeNode[]> {
    const { data } = await apiClient.get<Envelope<OrganizationTreeNode[]>>('/organizations/tree');
    return data.data;
  },

  async detail(id: string): Promise<AdminOrganizationDto> {
    const { data } = await apiClient.get<Envelope<AdminOrganizationDto>>(`/organizations/${id}`);
    return data.data;
  },

  async create(input: CreateOrganizationInput): Promise<AdminOrganizationDto> {
    const { data } = await apiClient.post<Envelope<AdminOrganizationDto>>(
      '/organizations',
      input,
    );
    return data.data;
  },

  async update(id: string, input: UpdateOrganizationInput): Promise<AdminOrganizationDto> {
    const { data } = await apiClient.patch<Envelope<AdminOrganizationDto>>(
      `/organizations/${id}`,
      input,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  },
};
