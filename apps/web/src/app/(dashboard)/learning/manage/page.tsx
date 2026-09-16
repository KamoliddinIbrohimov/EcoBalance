'use client';

import {
  LESSON_TYPE_LABELS_UZ,
  PERMISSION,
  type CourseDto,
  type LessonDto,
} from '@eco/shared';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CourseFormDialog } from '@/features/learning/components/course-form-dialog';
import { LessonFormDialog } from '@/features/learning/components/lesson-form-dialog';
import { LevelsPanel } from '@/features/learning/components/levels-panel';
import { MaterialsPanel } from '@/features/learning/components/materials-panel';
import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import {
  useCourseLessons,
  useCoursesList,
  useRemoveCourse,
  useRemoveLesson,
} from '@/features/learning/hooks/use-learning';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import type { ApiError } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function LearningManagePage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canReadCourses = hasPermission(PERMISSION.COURSES_READ);
  const canCreateCourse = hasPermission(PERMISSION.COURSES_CREATE);
  const canUpdateCourse = hasPermission(PERMISSION.COURSES_UPDATE);
  const canDeleteCourse = hasPermission(PERMISSION.COURSES_DELETE);
  const canManageLessons = hasPermission(PERMISSION.LESSONS_MANAGE);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseDto | null>(null);
  const [removingCourse, setRemovingCourse] = useState<CourseDto | null>(null);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonDto | null>(null);
  const [removingLesson, setRemovingLesson] = useState<LessonDto | null>(null);

  const { data: coursesData, isLoading: coursesLoading } = useCoursesList({
    page: 1,
    perPage: 50,
  });
  const courses = useMemo(() => coursesData?.data ?? [], [coursesData]);
  const { data: levels } = useEducationLevels();
  const levelNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    (levels ?? []).forEach((l) => map.set(l.slug, l.nameUz));
    return map;
  }, [levels]);
  const currentCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId],
  );

  const { data: lessons, isLoading: lessonsLoading } = useCourseLessons(currentCourse?.id);

  const removeCourse = useRemoveCourse();
  const removeLesson = useRemoveLesson();
  const courseErr = removeCourse.error as ApiError | undefined;
  const lessonErr = removeLesson.error as ApiError | undefined;

  if (!canReadCourses) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  const nextOrderIndex = lessons && lessons.length > 0
    ? Math.max(...lessons.map((l) => l.orderIndex)) + 1
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Ta&apos;lim — boshqaruv
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kurslar va darslarni yaratish, tahrirlash va o&apos;chirish.
          </p>
        </div>
      </div>

      {/* Ta'lim darajalari (sidebar bo'limlari) */}
      <LevelsPanel />

      {/* Kurslar */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Kurslar
          </h2>
          {canCreateCourse ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingCourse(null);
                setCourseDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Yangi kurs
            </Button>
          ) : null}
        </div>
        {coursesLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Yuklanmoqda…</div>
        ) : courses.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Kurslar yo&apos;q.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomi</TableHead>
                <TableHead>Ta&apos;lim darajasi</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Darslar</TableHead>
                <TableHead>Holati</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nameUz}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {levelNameBySlug.get(c.educationLevel) ?? c.educationLevel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>{c.lessonsCount}</TableCell>
                  <TableCell>
                    <Badge variant={c.isPublished ? 'default' : 'secondary'}>
                      {c.isPublished ? 'Nashr' : 'Qoralama'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {canUpdateCourse ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingCourse(c);
                            setCourseDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {canDeleteCourse ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRemovingCourse(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Darslar boshqaruvi */}
      {canManageLessons && courses.length > 0 ? (
        <Card className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Darslar
              </h2>
              <Select
                value={currentCourse?.id ?? ''}
                onValueChange={(v) => setSelectedCourseId(v)}
              >
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameUz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentCourse ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditingLesson(null);
                  setLessonDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Yangi dars
              </Button>
            ) : null}
          </div>

          {lessonsLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Yuklanmoqda…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Sarlavha</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lessons || lessons.length === 0 ? (
                  <TableEmpty colSpan={4}>Darslar yo&apos;q</TableEmpty>
                ) : (
                  lessons.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.orderIndex}</TableCell>
                      <TableCell className="font-medium">{l.titleUz}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{LESSON_TYPE_LABELS_UZ[l.lessonType]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingLesson(l);
                              setLessonDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setRemovingLesson(l)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : null}

      {currentCourse ? <MaterialsPanel courseId={currentCourse.id} /> : null}

      {/* Dialogs */}
      <CourseFormDialog
        open={courseDialogOpen}
        onOpenChange={setCourseDialogOpen}
        course={editingCourse}
      />

      {currentCourse ? (
        <LessonFormDialog
          open={lessonDialogOpen}
          onOpenChange={setLessonDialogOpen}
          courseId={currentCourse.id}
          lesson={editingLesson}
          nextOrderIndex={nextOrderIndex}
        />
      ) : null}

      <ConfirmDialog
        open={!!removingCourse}
        onOpenChange={(open) => !open && setRemovingCourse(null)}
        title={`"${removingCourse?.nameUz ?? ''}" kursini o'chirasizmi?`}
        description={
          courseErr?.message ??
          "Kurs va uning barcha darslari butunlay o'chiriladi. Bu amalni bekor qilib bo'lmaydi."
        }
        confirmLabel="Ha, o'chirish"
        loading={removeCourse.isPending}
        onConfirm={() => {
          if (!removingCourse) return;
          removeCourse.mutate(removingCourse.id, {
            onSuccess: () => setRemovingCourse(null),
          });
        }}
      />

      <ConfirmDialog
        open={!!removingLesson}
        onOpenChange={(open) => !open && setRemovingLesson(null)}
        title={`"${removingLesson?.titleUz ?? ''}" darsini o'chirasizmi?`}
        description={lessonErr?.message ?? "Bu amalni bekor qilib bo'lmaydi."}
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
