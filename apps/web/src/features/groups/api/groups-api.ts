import type {
  AddGroupMemberInput,
  CreateGroupInput,
  GroupMemberDto,
  GroupWithTeacherDto,
  UpdateGroupInput,
} from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export const groupsApi = {
  async list(): Promise<Paginated<GroupWithTeacherDto>> {
    const { data } = await apiClient.get<Paginated<GroupWithTeacherDto>>('/groups', {
      params: { page: 1, perPage: 100 },
    });
    return data;
  },

  async create(input: CreateGroupInput): Promise<GroupWithTeacherDto> {
    const { data } = await apiClient.post<Envelope<GroupWithTeacherDto>>('/groups', input);
    return data.data;
  },

  async update(id: string, input: UpdateGroupInput): Promise<GroupWithTeacherDto> {
    const { data } = await apiClient.patch<Envelope<GroupWithTeacherDto>>(`/groups/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/groups/${id}`);
  },

  async members(id: string): Promise<GroupMemberDto[]> {
    const { data } = await apiClient.get<Envelope<GroupMemberDto[]>>(`/groups/${id}/members`);
    return data.data;
  },

  async addMember(id: string, input: AddGroupMemberInput): Promise<GroupMemberDto> {
    const { data } = await apiClient.post<Envelope<GroupMemberDto>>(
      `/groups/${id}/members`,
      input,
    );
    return data.data;
  },

  async removeMember(id: string, studentId: string): Promise<void> {
    await apiClient.delete(`/groups/${id}/members/${studentId}`);
  },
};
