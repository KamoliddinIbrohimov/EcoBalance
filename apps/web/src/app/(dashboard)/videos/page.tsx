'use client';

import { PlayCircle } from 'lucide-react';

import { VideoLessonsList } from '@/features/learning/components/video-lessons-list';

export default function VideoLessonsPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PlayCircle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Video darslar</h1>
          <p className="text-sm text-muted-foreground">
            Mavzular bo‘yicha video darsliklar. Darsni tanlang — video dars sahifasining tepasida ochiladi.
          </p>
        </div>
      </div>
      <VideoLessonsList />
    </div>
  );
}
