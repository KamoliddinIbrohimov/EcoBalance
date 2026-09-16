'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { aiSettingsApi, type UpdateAiSettingsInput } from './ai-settings-api';

const KEY = ['platform-settings', 'ai'] as const;

export function useAiSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => aiSettingsApi.get(),
  });
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiSettingsInput) => aiSettingsApi.update(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
