import { apiClient } from '@/shared/lib/api-client';

export interface HomeMediaDto {
  ecoImageUrl: string | null;
  eduImageUrl: string | null;
}

export type HomeMediaCardKey = 'eco' | 'edu';

interface Envelope<T> {
  data: T;
}

export const homeMediaApi = {
  async get(): Promise<HomeMediaDto> {
    const { data } = await apiClient.get<Envelope<HomeMediaDto>>('/settings/home-media');
    return data.data;
  },
  async upload(cardKey: HomeMediaCardKey, file: File): Promise<HomeMediaDto> {
    const form = new FormData();
    form.append('cardKey', cardKey);
    form.append('file', file);
    const { data } = await apiClient.post<Envelope<HomeMediaDto>>('/settings/home-media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
};
