'use client';

import { PlayCircle } from 'lucide-react';

import { MaterialVideo } from '@/features/learning/components/material-video';
import { useCourseMaterials } from '@/features/learning/hooks/use-materials';
import { Card } from '@/shared/components/ui/card';

/** Darsga biriktirilgan video materiallar — dars sahifasining tepasida o'ynatiladi. */
export function LessonVideos({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { data } = useCourseMaterials(courseId);
  const videos = (data ?? []).filter((m) => m.lessonId === lessonId && m.mimeType.startsWith('video/'));
  if (videos.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
        <PlayCircle className="h-4 w-4" />
        Video darslik
      </h2>
      <div className="mt-3 space-y-3">
        {videos.map((m) => (
          <MaterialVideo key={m.id} material={m} />
        ))}
      </div>
    </Card>
  );
}
