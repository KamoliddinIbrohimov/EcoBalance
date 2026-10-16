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

  async courseBindings(groupId: string): Promise<Array<{
    courseId: string;
    groupId: string;
    course: { id: string; slug: string; nameUz: string; isPublished: boolean };
  }>> {
    const { data } = await apiClient.get<Envelope<Array<{
      courseId: string;
      groupId: string;
      course: { id: string; slug: string; nameUz: string; isPublished: boolean };
    }>>>(`/groups/${groupId}/courses`);
    return data.data;
  },

  async bindCourse(groupId: string, courseId: string): Promise<void> {
    await apiClient.post(`/groups/${groupId}/courses/${courseId}`);
  },

  async unbindCourse(groupId: string, courseId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}/courses/${courseId}`);
  },

  async quizBindings(groupId: string): Promise<Array<{
    quizId: string;
    groupId: string;
    quiz: { id: string; titleUz: string; isPublished: boolean; lessonId: string | null };
  }>> {
    const { data } = await apiClient.get<Envelope<Array<{
      quizId: string;
      groupId: string;
      quiz: { id: string; titleUz: string; isPublished: boolean; lessonId: string | null };
    }>>>(`/groups/${groupId}/quizzes`);
    return data.data;
  },

  async bindQuiz(groupId: string, quizId: string): Promise<void> {
    await apiClient.post(`/groups/${groupId}/quizzes/${quizId}`);
  },

  async unbindQuiz(groupId: string, quizId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}/quizzes/${quizId}`);
  },

  async listReleases(groupId: string): Promise<Array<{
    id: string;
    groupId: string;
    lessonId: string | null;
    moduleId: string | null;
    opensAt: string | null;
    closesAt: string | null;
    status: 'LOCKED' | 'SCHEDULED' | 'OPEN';
  }>> {
    const { data } = await apiClient.get<Envelope<Array<{
      id: string;
      groupId: string;
      lessonId: string | null;
      moduleId: string | null;
      opensAt: string | null;
      closesAt: string | null;
      status: 'LOCKED' | 'SCHEDULED' | 'OPEN';
    }>>>(`/groups/${groupId}/releases`);
    return data.data;
  },

  async upsertRelease(
    groupId: string,
    input: {
      lessonId?: string;
      moduleId?: string;
      opensAt?: string | null;
      closesAt?: string | null;
      status: 'LOCKED' | 'SCHEDULED' | 'OPEN';
    },
  ): Promise<void> {
    await apiClient.post(`/groups/${groupId}/releases`, input);
  },

  async removeRelease(groupId: string, releaseId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}/releases/${releaseId}`);
  },

  async transferMember(fromGroupId: string, studentId: string, toGroupId: string): Promise<void> {
    await apiClient.post(`/groups/${fromGroupId}/members/${studentId}/transfer`, { toGroupId });
  },
};
