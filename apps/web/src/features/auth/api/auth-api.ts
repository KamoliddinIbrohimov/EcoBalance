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

export interface AuthLoginResponse extends AuthTokensResponse {
  user: AuthUser;
}

interface Envelope<T> {
  data: T;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthLoginResponse> {
    const { data } = await apiClient.post<Envelope<AuthLoginResponse>>('/auth/login', input);
    return data.data;
  },

  async register(input: RegisterInput): Promise<AuthLoginResponse> {
    const { data } = await apiClient.post<Envelope<AuthLoginResponse>>('/auth/register', input);
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
    // _skipAuthRetry — 401 kelsa refresh urinishi kerak emas (endpoint Public,
    // access token yaroqsiz bo'lsa ham backend cookie'ni tozalaydi).
    await apiClient.post('/auth/logout', undefined, { _skipAuthRetry: true } as never);
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<Envelope<AuthUser>>('/auth/me');
    return data.data;
  },
};
