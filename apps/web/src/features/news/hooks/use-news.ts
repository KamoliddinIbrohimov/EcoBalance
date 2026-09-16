'use client';

import type { CreateNewsInput, NewsQuery, UpdateNewsInput } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { newsApi } from '../api/news-api';

const KEY = ['news'] as const;

export function useNewsList(query: Partial<NewsQuery> = {}) {
  return useQuery({
    queryKey: [...KEY, 'list', query],
    queryFn: () => newsApi.list(query),
  });
}

export function useNewsItem(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'item', id],
    queryFn: () => (id ? newsApi.findById(id) : Promise.reject('no id')),
    enabled: !!id,
  });
}

export function useCreateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, file }: { input: CreateNewsInput; file?: File | null }) =>
      newsApi.create(input, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, file }: { id: string; input: UpdateNewsInput; file?: File | null }) =>
      newsApi.update(id, input, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRemoveNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => newsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
