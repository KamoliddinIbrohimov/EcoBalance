import type { CreateNewsInput, NewsDto, NewsQuery, UpdateNewsInput } from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

interface Page<T> {
  data: T[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

export const newsApi = {
  async list(query: Partial<NewsQuery> = {}): Promise<Page<NewsDto>> {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.perPage) params.set('perPage', String(query.perPage));
    if (query.isPublished !== undefined) params.set('isPublished', String(query.isPublished));
    const q = params.toString() ? `?${params.toString()}` : '';
    const { data } = await apiClient.get<Envelope<Page<NewsDto>>>(`/news${q}`);
    return data.data;
  },

  async findById(id: string): Promise<NewsDto> {
    const { data } = await apiClient.get<Envelope<NewsDto>>(`/news/${id}`);
    return data.data;
  },

  async create(input: CreateNewsInput, file?: File | null): Promise<NewsDto> {
    const fd = new FormData();
    fd.append('titleUz', input.titleUz);
    fd.append('bodyUz', input.bodyUz);
    fd.append('isPublished', String(input.isPublished));
    if (file) fd.append('file', file);
    const { data } = await apiClient.post<Envelope<NewsDto>>('/news', fd);
    return data.data;
  },

  async update(id: string, input: UpdateNewsInput, file?: File | null): Promise<NewsDto> {
    const fd = new FormData();
    if (input.titleUz !== undefined) fd.append('titleUz', input.titleUz);
    if (input.bodyUz !== undefined) fd.append('bodyUz', input.bodyUz);
    if (input.isPublished !== undefined) fd.append('isPublished', String(input.isPublished));
    if (input.removeAttachment) fd.append('removeAttachment', 'true');
    if (file) fd.append('file', file);
    const { data } = await apiClient.patch<Envelope<NewsDto>>(`/news/${id}`, fd);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/news/${id}`);
  },
};
