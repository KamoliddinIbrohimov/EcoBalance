'use client';

import type { ChangePasswordInput, UpdateProfileInput } from '@eco/shared';
import { useMutation } from '@tanstack/react-query';

import { useAuthStore } from '@/shared/stores/auth-store';
import { profileApi } from './profile-api';

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => profileApi.updateProfile(input),
    onSuccess: (user) => setUser(user),
  });
}

export function useUploadAvatar() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: (user) => setUser(user),
  });
}

export function useRemoveAvatar() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: () => profileApi.removeAvatar(),
    onSuccess: (user) => setUser(user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => profileApi.changePassword(input),
  });
}
