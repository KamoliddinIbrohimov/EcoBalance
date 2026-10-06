'use client';

import type { LessonDto } from '@eco/shared';
import { LESSON_TYPE_LABELS_UZ } from '@eco/shared';
import { Beaker, BookOpen, ChevronRight, Compass, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';

const TYPE_ICON = {
  MARUZA: BookOpen,
  AMALIY: ClipboardList,
  LABORATORIYA: Beaker,
  EKSKURSIYA: Compass,
} as const;

interface LessonListItemProps {
  lesson: LessonDto;
  courseSlug: string;
  /** O'zgartirish rejimida — o'chirish/tahrirlash tugmalarini ko'rsatadi. */
  onEdit?: (lesson: LessonDto) => void;
  onRemove?: (lesson: LessonDto) => void;
}

export function LessonListItem({ lesson, courseSlug, onEdit, onRemove }: LessonListItemProps) {
  const Icon = TYPE_ICON[lesson.lessonType];
  const hasControls = !!onEdit || !!onRemove;

  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
        {lesson.orderIndex}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs">
            {LESSON_TYPE_LABELS_UZ[lesson.lessonType]}
          </Badge>
        </div>
        <h4 className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">
          {lesson.titleUz}
        </h4>
        {lesson.objectiveUz ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{lesson.objectiveUz}</p>
        ) : null}
      </div>
    </>
  );

  if (hasControls) {
    return (
      <div
        className={cn(
          'group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/60',
        )}
      >
        <Link
          href={`/learning/${courseSlug}/${lesson.id}`}
          className="flex flex-1 items-center gap-4"
        >
          {content}
        </Link>
        <div className="flex shrink-0 gap-1">
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEdit(lesson)}
              title="Tahrirlash"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRemove(lesson)}
              title="O'chirish"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/learning/${courseSlug}/${lesson.id}`}
      className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/60"
    >
      {content}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}
