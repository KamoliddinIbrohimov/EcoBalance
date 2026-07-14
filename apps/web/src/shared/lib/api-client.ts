import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { env } from '@/shared/config/env';
import { useAuthStore } from '@/shared/stores/auth-store';

type Retry = InternalAxiosRequestConfig & { _retry?: boolean };

interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }

  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(client: AxiosInstance): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const { data } = await client.post<{ data: { accessToken: string; expiresIn: number } }>(
        '/auth/refresh',
        {},
        { withCredentials: true, _skipAuthRetry: true } as never,
      );
      const token = data.data.accessToken;
      useAuthStore.getState().setAccessToken(token, data.data.expiresIn);
      return token;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    timeout: 30_000,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });

  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError<ProblemDetails>) => {
      const original = error.config as Retry | undefined;

      if (error.response?.status === 401 && original && !original._retry) {
        original._retry = true;
        const newToken = await refreshAccessToken(client);
        if (newToken) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return client(original);
        }
      }

      if (error.response?.data) {
        throw new ApiError(error.response.data);
      }

      throw new ApiError({
        title: 'Network error',
        status: 0,
        detail: error.message,
      });
    },
  );

  return client;
}

export const apiClient = createApiClient();
