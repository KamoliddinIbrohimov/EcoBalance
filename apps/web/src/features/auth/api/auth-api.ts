import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';
import type { AuthUser } from '@/shared/stores/auth-store';

export interface AuthTokensResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

interface Envelope<T> {
  data: T;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthTokensResponse> {
    const { data } = await apiClient.post<Envelope<AuthTokensResponse>>('/auth/login', input);
    return data.data;
  },

  async register(input: RegisterInput): Promise<AuthTokensResponse> {
    const { data } = await apiClient.post<Envelope<AuthTokensResponse>>('/auth/register', input);
    return data.data;
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const { data } = await apiClient.post<Envelope<{ ok: true }>>('/auth/forgot-password', input);
    return data.data;
  },

  async resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
    const { data } = await apiClient.post<Envelope<{ ok: true }>>('/auth/reset-password', input);
    return data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<Envelope<AuthUser>>('/auth/me');
    return data.data;
  },
};
