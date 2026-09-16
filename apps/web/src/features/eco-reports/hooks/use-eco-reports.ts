'use client';

import type {
  CreateEcoReportInput,
  EcoReportQuery,
  UpdateEcoReportStatusInput,
} from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ecoReportsApi } from '../api/eco-reports-api';

const LIST_KEY = ['eco-reports', 'list'] as const;
const STATS_KEY = ['eco-reports', 'stats'] as const;

export function useEcoReportsList(query: Partial<EcoReportQuery>) {
  return useQuery({
    queryKey: [...LIST_KEY, query],
    queryFn: () => ecoReportsApi.list(query),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function useEcoStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: () => ecoReportsApi.stats(),
    staleTime: 30_000,
  });
}

export function useCreateEcoReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEcoReportInput) => ecoReportsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useUpdateEcoReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEcoReportStatusInput }) =>
      ecoReportsApi.updateStatus(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useRemoveEcoReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ecoReportsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}
