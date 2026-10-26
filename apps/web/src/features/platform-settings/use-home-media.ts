'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { homeMediaApi, type HomeMediaCardKey } from './home-media-api';

const KEY = ['platform-settings', 'home-media'] as const;

/** Yuklangan rasm manzillari — barcha kirgan foydalanuvchilar o'qiy oladi (yuklash faqat SUPER_ADMIN). */
export function useHomeMedia() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => homeMediaApi.get(),
  });
}

export function useUploadHomeMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardKey, file }: { cardKey: HomeMediaCardKey; file: File }) =>
      homeMediaApi.upload(cardKey, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
