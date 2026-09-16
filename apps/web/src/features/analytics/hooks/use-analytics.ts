'use client';

import { useQuery } from '@tanstack/react-query';

import { analyticsApi } from '../api/analytics-api';

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'] as const,
    queryFn: () => analyticsApi.overview(),
    staleTime: 30_000,
  });
}

export function useRecentAudit(limit = 20) {
  return useQuery({
    queryKey: ['analytics', 'audit-recent', limit] as const,
    queryFn: () => analyticsApi.recentAudit(limit),
    staleTime: 30_000,
  });
}
