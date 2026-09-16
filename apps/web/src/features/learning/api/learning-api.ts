import type {
  CourseDto,
  CourseQuery,
  CreateCourseInput,
  CreateLessonInput,
  LessonDto,
  LessonQuery,
  LessonWithCourseDto,
  UpdateCourseInput,
  UpdateLessonInput,
} from '@eco/shared';

import type { PaginatedResult } from '@/features/users/api/users-api';
import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

function toQueryParams<T extends object>(query: Partial<T>) {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params[key] = value as string | number | boolean;
  }
  return params;
}

export const learningApi = {
  // Courses
  async listCourses(query: Partial<CourseQuery>): Promise<PaginatedResult<CourseDto>> {
    const { data } = await apiClient.get<PaginatedResult<CourseDto>>('/courses', {
      params: toQueryParams(query),
    });
    return data;
  },

  async courseBySlug(slug: string): Promise<CourseDto> {
    const { data } = await apiClient.get<Envelope<CourseDto>>(`/courses/slug/${slug}`);
    return data.data;
  },

  async courseById(id: string): Promise<CourseDto> {
    const { data } = await apiClient.get<Envelope<CourseDto>>(`/courses/${id}`);
    return data.data;
  },

  async courseLessons(courseId: string): Promise<LessonDto[]> {
    const { data } = await apiClient.get<Envelope<LessonDto[]>>(`/courses/${courseId}/lessons`);
    return data.data;
  },

  async createCourse(input: CreateCourseInput): Promise<CourseDto> {
    const { data } = await apiClient.post<Envelope<CourseDto>>('/courses', input);
    return data.data;
  },

  async updateCourse(id: string, input: UpdateCourseInput): Promise<CourseDto> {
    const { data } = await apiClient.patch<Envelope<CourseDto>>(`/courses/${id}`, input);
    return data.data;
  },

  async removeCourse(id: string): Promise<void> {
    await apiClient.delete(`/courses/${id}`);
  },

  // Lessons
  async listLessons(query: Partial<LessonQuery>): Promise<PaginatedResult<LessonDto>> {
    const { data } = await apiClient.get<PaginatedResult<LessonDto>>('/lessons', {
      params: toQueryParams(query),
    });
    return data;
  },

  async lessonById(id: string): Promise<LessonWithCourseDto> {
    const { data } = await apiClient.get<Envelope<LessonWithCourseDto>>(`/lessons/${id}`);
    return data.data;
  },

  async createLesson(input: CreateLessonInput): Promise<LessonDto> {
    const { data } = await apiClient.post<Envelope<LessonDto>>('/lessons', input);
    return data.data;
  },

  async updateLesson(id: string, input: UpdateLessonInput): Promise<LessonDto> {
    const { data } = await apiClient.patch<Envelope<LessonDto>>(`/lessons/${id}`, input);
    return data.data;
  },

  async removeLesson(id: string): Promise<void> {
    await apiClient.delete(`/lessons/${id}`);
  },
};
