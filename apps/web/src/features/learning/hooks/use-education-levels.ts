'use client';

import type {
  CreateEducationLevelItemInput,
  UpdateEducationLevelItemInput,
} from '@eco/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { educationLevelsApi } from '../api/education-levels-api';

const KEY = ['learning', 'education-levels'] as const;

export function useEducationLevels() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => educationLevelsApi.list(),
    // Default staleTime (30s) — invalidateQueries mutation'lardan keyin
    // avtomatik refetch qiladi. staleTime=0 + refetchOnWindowFocus tinimsiz
    // refetch qilib, 401/refresh siklini keltirib chiqarardi.
  });
}

async function refetchLevels(qc: QueryClient) {
  await qc.invalidateQueries({ queryKey: KEY });
  await qc.refetchQueries({ queryKey: KEY });
}

export function useCreateEducationLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEducationLevelItemInput) => educationLevelsApi.create(input),
    onSuccess: () => refetchLevels(qc),
  });
}

export function useUpdateEducationLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEducationLevelItemInput }) =>
      educationLevelsApi.update(id, input),
    onSuccess: () => refetchLevels(qc),
  });
}

export function useRemoveEducationLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => educationLevelsApi.remove(id),
    onSuccess: () => refetchLevels(qc),
  });
}
