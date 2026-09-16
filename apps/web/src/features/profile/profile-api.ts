import type { ChangePasswordInput, UpdateProfileInput } from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';
import type { AuthUser } from '@/shared/stores/auth-store';

interface Envelope<T> {
  data: T;
}

export const profileApi = {
  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<Envelope<AuthUser>>('/auth/me');
    return data.data;
  },
  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    const { data } = await apiClient.patch<Envelope<AuthUser>>('/auth/me', input);
    return data.data;
  },
  async uploadAvatar(file: File): Promise<AuthUser> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await apiClient.post<Envelope<AuthUser>>('/auth/me/avatar', fd);
    return data.data;
  },
  async removeAvatar(): Promise<AuthUser> {
    const { data } = await apiClient.delete<Envelope<AuthUser>>('/auth/me/avatar');
    return data.data;
  },
  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiClient.post('/auth/me/change-password', input);
  },
};
