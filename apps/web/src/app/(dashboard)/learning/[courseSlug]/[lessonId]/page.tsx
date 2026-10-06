'use client';

import { LESSON_TYPE_LABELS_UZ, PERMISSION } from '@eco/shared';
import { ArrowLeft, Beaker, BookOpen, ClipboardList, Compass, Target, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { MaterialsPanel } from '@/features/learning/components/materials-panel';
import { useLesson } from '@/features/learning/hooks/use-learning';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

const TYPE_ICON = {
  MARUZA: BookOpen,
  AMALIY: ClipboardList,
  LABORATORIYA: Beaker,
  EKSKURSIYA: Compass,
} as const;

export default function LessonDetailPage() {
  const params = useParams<{ courseSlug: string; lessonId: string }>();
  const courseSlug = params?.courseSlug;
  const lessonId = params?.lessonId;
  const t = useTranslations('learning');

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.COURSES_READ);

  const { data: lesson, isLoading } = useLesson(lessonId);

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  if (isLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">{t('loading')}</Card>;
  }

  if (!lesson) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">{t('lessonNotFound')}</Card>;
  }

  const Icon = TYPE_ICON[lesson.lessonType];

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={`/learning/${courseSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {lesson.course.nameUz}
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            {LESSON_TYPE_LABELS_UZ[lesson.lessonType]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('lessonNumber', { n: lesson.orderIndex })}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{lesson.titleUz}</h1>
      </div>

      {lesson.objectiveUz ? (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Target className="h-4 w-4" />
            {t('objective')}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
            {lesson.objectiveUz}
          </p>
        </Card>
      ) : null}

      {lesson.equipmentUz ? (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Wrench className="h-4 w-4" />
            {t('equipment')}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
            {lesson.equipmentUz}
          </p>
        </Card>
      ) : null}

      {lesson.theoryUz ? (
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t('theory')}
          </h2>
          <div className="prose prose-sm mt-3 max-w-none whitespace-pre-line leading-relaxed text-foreground">
            {lesson.theoryUz}
          </div>
        </Card>
      ) : null}

      {lesson.procedureUz.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t('practice')}
          </h2>
          <ol className="mt-4 space-y-3">
            {lesson.procedureUz.map((task, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground">{task}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <MaterialsPanel
        courseId={lesson.course.id}
        lessonId={lesson.id}
        title={t('lessonMaterialsLabel')}
        viewOnly
      />
    </div>
  );
}
