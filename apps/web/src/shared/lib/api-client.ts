import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { env } from '@/shared/config/env';
import { useAuthStore, type AuthUser } from '@/shared/stores/auth-store';

type Retry = InternalAxiosRequestConfig & { _retry?: boolean; _skipAuthRetry?: boolean };

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

export interface AuthRefreshResult {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

/**
 * Butun ilova bo'ylab yagona /auth/refresh singleton'i.
 *
 * Nima uchun bu muhim:
 *   • Sahifa yuklanganda AuthBoot va bir necha React Query hook bir vaqtda
 *     ishga tushadi. Har biri o'zicha /auth/refresh yuborsa — server ustida
 *     N ta refresh nuqtasi qamalib, rate limit tez to'ladi va race condition
 *     paydo bo'ladi.
 *   • Bu funksiya birinchi chaqirg'ida "in-flight promise" yaratadi va tugaguncha
 *     har kim shu promise'ni kutadi. Server faqat 1 marta uriladi. Natija —
 *     access token va user — auth-store'ga yozib qo'yiladi.
 */
let refreshInFlight: Promise<AuthRefreshResult> | null = null;

/**
 * /auth/refresh singleton — muvaffaqiyatli bo'lsa tokenlarni auth-store'ga
 * yozadi va natijani qaytaradi. Muvaffaqiyatsizlikda ApiError bilan tashlaydi:
 *   • status 401 — cookie yaroqsiz, auth-store'ni tozalaydi
 *   • boshqa (5xx / 429 / 0) — tranzient, store'ga tegmaydi
 */
export function refreshAuthSession(
  client: AxiosInstance = apiClient,
): Promise<AuthRefreshResult> {
  refreshInFlight ??= (async () => {
    try {
      const { data } = await client.post<{
        data: AuthRefreshResult;
      }>(
        '/auth/refresh',
        {},
        { withCredentials: true, _skipAuthRetry: true } as never,
      );
      const result = data.data;
      const store = useAuthStore.getState();
      store.setAccessToken(result.accessToken, result.expiresIn);
      store.setUser(result.user);
      return result;
    } catch (err) {
      const status = (err as AxiosError | ApiError)?.status
        ?? (err as AxiosError)?.response?.status;
      if (status === 401) {
        useAuthStore.getState().clear();
      }
      throw err;
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

      if (
        error.response?.status === 401 &&
        original &&
        !original._retry &&
        !original._skipAuthRetry
      ) {
        original._retry = true;
        try {
          const result = await refreshAuthSession(client);
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization =
            `Bearer ${result.accessToken}`;
          return client(original);
        } catch {
          // Refresh muvaffaqiyatsiz — asl xatoni ApiError'ga aylantirib ta'shlaymiz.
        }
      }

      const httpStatus = error.response?.status ?? 0;
      const body = error.response?.data as ProblemDetails | string | undefined;

      // Backend problem+json javob qaytargan bo'lsa — o'shandan foydalanamiz.
      if (body && typeof body === 'object' && typeof body.title === 'string') {
        throw new ApiError({ ...body, status: body.status ?? httpStatus });
      }

      // 5xx / nginx HTML / boshqa "flat" javoblar — status'ni HTTP dan olamiz.
      throw new ApiError({
        title: httpStatus >= 500 ? 'Server error' : 'Network error',
        status: httpStatus,
        detail: error.message,
      });
    },
  );

  return client;
}

export const apiClient = createApiClient();
