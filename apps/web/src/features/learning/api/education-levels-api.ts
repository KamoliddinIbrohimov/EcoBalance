import type {
  CreateEducationLevelItemInput,
  EducationLevelItemDto,
  UpdateEducationLevelItemInput,
} from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

export const educationLevelsApi = {
  async list(): Promise<EducationLevelItemDto[]> {
    const { data } = await apiClient.get<Envelope<EducationLevelItemDto[]>>('/education-levels');
    return data.data;
  },
  async create(input: CreateEducationLevelItemInput): Promise<EducationLevelItemDto> {
    const { data } = await apiClient.post<Envelope<EducationLevelItemDto>>(
      '/education-levels',
      input,
    );
    return data.data;
  },
  async update(id: string, input: UpdateEducationLevelItemInput): Promise<EducationLevelItemDto> {
    const { data } = await apiClient.patch<Envelope<EducationLevelItemDto>>(
      `/education-levels/${id}`,
      input,
    );
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/education-levels/${id}`);
  },
};
