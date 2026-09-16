'use client';

import type {
  CourseQuery,
  CreateCourseInput,
  CreateLessonInput,
  LessonQuery,
  UpdateCourseInput,
  UpdateLessonInput,
} from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { learningApi } from '../api/learning-api';

const COURSES_KEY = ['learning', 'courses'] as const;
const LESSONS_KEY = ['learning', 'lessons'] as const;

// ---- Courses ----

export function useCoursesList(query: Partial<CourseQuery>) {
  return useQuery({
    queryKey: [...COURSES_KEY, 'list', query],
    queryFn: () => learningApi.listCourses(query),
    placeholderData: (previous) => previous,
  });
}

export function useCourseBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: [...COURSES_KEY, 'slug', slug],
    queryFn: () => learningApi.courseBySlug(slug!),
    enabled: !!slug,
  });
}

export function useCourseLessons(courseId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, 'course', courseId],
    queryFn: () => learningApi.courseLessons(courseId!),
    enabled: !!courseId,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCourseInput) => learningApi.createCourse(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
    },
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCourseInput }) =>
      learningApi.updateCourse(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
    },
  });
}

export function useRemoveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => learningApi.removeCourse(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
      void qc.invalidateQueries({ queryKey: LESSONS_KEY });
    },
  });
}

// ---- Lessons ----

export function useLessonsList(query: Partial<LessonQuery>) {
  return useQuery({
    queryKey: [...LESSONS_KEY, 'list', query],
    queryFn: () => learningApi.listLessons(query),
    placeholderData: (previous) => previous,
  });
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, 'detail', id],
    queryFn: () => learningApi.lessonById(id!),
    enabled: !!id,
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLessonInput) => learningApi.createLesson(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LESSONS_KEY });
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
    },
  });
}

export function useUpdateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLessonInput }) =>
      learningApi.updateLesson(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LESSONS_KEY });
    },
  });
}

export function useRemoveLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => learningApi.removeLesson(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LESSONS_KEY });
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
    },
  });
}
