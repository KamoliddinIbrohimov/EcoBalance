'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { useAuthStore } from '@/shared/stores/auth-store';
import { authApi } from '../api/auth-api';

const ME_KEY = ['auth', 'me'] as const;

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (result) => {
      setAccessToken(result.accessToken, result.expiresIn);
      setUser(result.user);
      qc.setQueryData(ME_KEY, result.user);
      router.push('/');
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const qc = useQueryClient();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: async (result) => {
      setAccessToken(result.accessToken, result.expiresIn);
      setUser(result.user);
      qc.setQueryData(ME_KEY, result.user);
      router.push('/');
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => router.push('/login'),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const clear = useAuthStore((s) => s.clear);

  return useCallback(async () => {
    // 1) Backend'ni chaqirib refresh_token cookie'ni tozalash. Bu await bo'lishi shart —
    //    aks holda brauzer navigatsiya boshlashi bilanoq so'rov bekor qilinadi va cookie
    //    saqlanib qoladi (natijada middleware /login ga o'tishga ruxsat bermaydi).
    try {
      await authApi.logout();
    } catch {
      /* server xatosi bo'lsa ham davom etamiz */
    }
    // 2) Klient tarafida saqlangan holatni tozalash.
    try {
      clear();
      qc.clear();
    } catch {
      /* ignore */
    }
    // 3) To'liq sahifa qayta yuklashi — middleware yangi (bo'sh) cookie holati bilan ishga
    //    tushadi va /login sahifasini ochadi. window.location.href sinxron navigatsiya.
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [clear, qc]);
}
