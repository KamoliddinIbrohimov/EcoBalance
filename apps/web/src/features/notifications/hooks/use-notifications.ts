'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi } from '../api/notifications-api';

const KEY = ['notifications'] as const;

export function useNotifications(limit = 30) {
  return useQuery({
    queryKey: [...KEY, 'list', limit],
    queryFn: () => notificationsApi.list(limit),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...KEY, 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    // Har 60 sekundda soatning yangi qiymatini olamiz
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
