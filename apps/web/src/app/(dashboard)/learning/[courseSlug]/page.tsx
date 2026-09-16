'use client';

import { PERMISSION, type LessonDto } from '@eco/shared';
import { ArrowLeft, BookOpen, Pencil, Plus, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CourseFormDialog } from '@/features/learning/components/course-form-dialog';
import { LessonFormDialog } from '@/features/learning/components/lesson-form-dialog';
import { LessonListItem } from '@/features/learning/components/lesson-list-item';
import { MaterialsPanel } from '@/features/learning/components/materials-panel';
import {
  useCourseBySlug,
  useCourseLessons,
  useRemoveLesson,
} from '@/features/learning/hooks/use-learning';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import type { ApiError } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function CourseDetailPage() {
  const params = useParams<{ courseSlug: string }>();
  const slug = params?.courseSlug;
  const t = useTranslations('learning');

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.COURSES_READ);
  const canEditCourse = hasPermission(PERMISSION.COURSES_UPDATE);
  const canManageLessons = hasPermission(PERMISSION.LESSONS_MANAGE);
  const canEdit = canEditCourse || canManageLessons;

  const { data: course, isLoading: courseLoading } = useCourseBySlug(slug);
  const { data: lessons, isLoading: lessonsLoading } = useCourseLessons(course?.id);

  // Ko'rish / O'zgartirish rejimi. Ruxsat bo'lsa ham default — "ko'rish"; foydalanuvchi
  // "O'zgartirish" tugmasi bilan boshqaruvni yoqadi.
  const [editMode, setEditMode] = useState(false);

  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonDto | null>(null);
  const [removingLesson, setRemovingLesson] = useState<LessonDto | null>(null);

  const removeLesson = useRemoveLesson();
  const removeErr = removeLesson.error as ApiError | undefined;

  const nextOrderIndex = useMemo(
    () => (lessons && lessons.length > 0 ? Math.max(...lessons.map((l) => l.orderIndex)) + 1 : 1),
    [lessons],
  );

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  if (courseLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">{t('loading')}</Card>;
  }

  if (!course) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">{t('courseNotFound')}</Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/learning"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('allCourses')}
        </Link>
        {canEdit ? (
          editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
              {t('viewMode')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEditMode(true)}>
              <Settings className="h-4 w-4" />
              {t('editMode')}
            </Button>
          )
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {course.nameUz}
              </h1>
              <Badge variant={course.isPublished ? 'default' : 'secondary'}>
                {course.isPublished ? t('published') : t('draft')}
              </Badge>
            </div>
            {course.descriptionUz ? (
              <p className="text-sm text-muted-foreground">{course.descriptionUz}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t('lessonsCount', { count: course.lessonsCount })}
            </p>
          </div>
          {editMode && canEditCourse ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCourseDialogOpen(true)}
              title={t('courseSettings')}
            >
              <Pencil className="h-4 w-4" />
              {t('courseSettings')}
            </Button>
          ) : null}
        </div>
      </div>

      <MaterialsPanel courseId={course.id} viewOnly={!editMode} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('lessonsLabel')}</h2>
          {editMode && canManageLessons ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingLesson(null);
                setLessonDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('newLesson')}
            </Button>
          ) : null}
        </div>
        {lessonsLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t('loading')}</Card>
        ) : !lessons || lessons.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {t('noLessonsYet')}
          </Card>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <LessonListItem
                key={lesson.id}
                lesson={lesson}
                courseSlug={course.slug}
                onEdit={
                  editMode && canManageLessons
                    ? (l) => {
                        setEditingLesson(l);
                        setLessonDialogOpen(true);
                      }
                    : undefined
                }
                onRemove={
                  editMode && canManageLessons ? (l) => setRemovingLesson(l) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs — faqat edit rejimida ochilishi mumkin */}
      <CourseFormDialog
        open={courseDialogOpen}
        onOpenChange={setCourseDialogOpen}
        course={course}
      />

      <LessonFormDialog
        open={lessonDialogOpen}
        onOpenChange={setLessonDialogOpen}
        courseId={course.id}
        lesson={editingLesson}
        nextOrderIndex={nextOrderIndex}
      />

      <ConfirmDialog
        open={!!removingLesson}
        onOpenChange={(open) => !open && setRemovingLesson(null)}
        title={`"${removingLesson?.titleUz ?? ''}" darsini o'chirasizmi?`}
        description={removeErr?.message ?? "Bu amalni bekor qilib bo'lmaydi."}
        confirmLabel="Ha, o'chirish"
        loading={removeLesson.isPending}
        onConfirm={() => {
          if (!removingLesson) return;
          removeLesson.mutate(removingLesson.id, {
            onSuccess: () => setRemovingLesson(null),
          });
        }}
      />
    </div>
  );
}
