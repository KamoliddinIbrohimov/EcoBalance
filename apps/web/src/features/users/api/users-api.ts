import type {
  AdminUserDto,
  CreateUserInput,
  PaginatedMeta,
  UpdateUserInput,
  UserQuery,
} from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginatedMeta;
}

function toQueryParams(query: Partial<UserQuery>): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params[key] = value as string | number | boolean;
  }
  return params;
}

export const usersApi = {
  async list(query: Partial<UserQuery>): Promise<PaginatedResult<AdminUserDto>> {
    const { data } = await apiClient.get<PaginatedResult<AdminUserDto>>('/users', {
      params: toQueryParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<AdminUserDto> {
    const { data } = await apiClient.get<Envelope<AdminUserDto>>(`/users/${id}`);
    return data.data;
  },

  async create(input: CreateUserInput): Promise<AdminUserDto> {
    const { data } = await apiClient.post<Envelope<AdminUserDto>>('/users', input);
    return data.data;
  },

  async update(id: string, input: UpdateUserInput): Promise<AdminUserDto> {
    const { data } = await apiClient.patch<Envelope<AdminUserDto>>(`/users/${id}`, input);
    return data.data;
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};

export interface RoleOption {
  id: string;
  slug: string;
  nameUz: string;
  description: string | null;
}

export const rolesApi = {
  async list(): Promise<RoleOption[]> {
    const { data } = await apiClient.get<Envelope<RoleOption[]>>('/roles');
    return data.data;
  },
};
