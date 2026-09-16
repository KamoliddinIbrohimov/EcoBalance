import { apiClient } from '@/shared/lib/api-client';

export interface NotificationDto {
  id: string;
  type: string;
  titleUz: string;
  bodyUz: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

interface Envelope<T> {
  data: T;
}

export const notificationsApi = {
  async list(limit = 30): Promise<NotificationDto[]> {
    const { data } = await apiClient.get<Envelope<NotificationDto[]>>(
      `/notifications?limit=${limit}`,
    );
    return data.data;
  },
  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<Envelope<{ count: number }>>(
      '/notifications/unread-count',
    );
    return data.data.count;
  },
  async markRead(ids: string[]): Promise<void> {
    await apiClient.patch('/notifications/read', { ids });
  },
  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all', {});
  },
};
