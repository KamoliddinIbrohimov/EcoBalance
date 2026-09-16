'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { materialsApi } from '../api/materials-api';

const MAT_KEY = (courseId: string) => ['learning', 'materials', courseId] as const;

export function useCourseMaterials(courseId: string | undefined) {
  return useQuery({
    queryKey: courseId ? MAT_KEY(courseId) : ['learning', 'materials', 'none'],
    queryFn: () => (courseId ? materialsApi.list(courseId) : Promise.resolve([])),
    enabled: !!courseId,
  });
}

export function useUploadMaterial(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, lessonId }: { file: File; lessonId?: string }) =>
      materialsApi.upload(courseId, file, lessonId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MAT_KEY(courseId) });
    },
  });
}

export function useRemoveMaterial(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => materialsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MAT_KEY(courseId) });
    },
  });
}
