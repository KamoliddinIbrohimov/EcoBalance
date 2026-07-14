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

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (tokens) => {
      setAccessToken(tokens.accessToken, tokens.expiresIn);
      await qc.invalidateQueries({ queryKey: ME_KEY });
      router.push('/');
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const qc = useQueryClient();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: async (tokens) => {
      setAccessToken(tokens.accessToken, tokens.expiresIn);
      await qc.invalidateQueries({ queryKey: ME_KEY });
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
  const router = useRouter();
  const qc = useQueryClient();
  const clear = useAuthStore((s) => s.clear);

  return useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clear();
    qc.clear();
    router.push('/login');
  }, [clear, qc, router]);
}
