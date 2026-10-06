'use client';

import type {
  CreateQuestionInput,
  CreateQuizInput,
  QuizQuery,
  ReorderQuestionsInput,
  SubmissionQuery,
  SubmitQuizInput,
  UpdateQuestionInput,
  UpdateQuizInput,
} from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { quizzesAdminApi, quizzesUserApi } from '../api/quizzes-api';

const QUIZZES_KEY = ['quizzes'] as const;
const USER_QUIZZES_KEY = ['my-quizzes'] as const;

// -----------------------------------------------------------------
// Admin — list / detail / CRUD
// -----------------------------------------------------------------

export function useAdminQuizzes(query: Partial<QuizQuery> = {}) {
  return useQuery({
    queryKey: [...QUIZZES_KEY, 'list', query],
    queryFn: () => quizzesAdminApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useAdminQuizDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: [...QUIZZES_KEY, 'detail', id],
    queryFn: () => quizzesAdminApi.detail(id!),
    enabled: !!id,
  });
}

export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuizInput) => quizzesAdminApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUIZZES_KEY });
      void qc.invalidateQueries({ queryKey: USER_QUIZZES_KEY });
    },
  });
}

export function useUpdateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateQuizInput }) =>
      quizzesAdminApi.update(id, input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: QUIZZES_KEY });
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'detail', variables.id] });
      void qc.invalidateQueries({ queryKey: USER_QUIZZES_KEY });
    },
  });
}

export function useRemoveQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quizzesAdminApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUIZZES_KEY });
      void qc.invalidateQueries({ queryKey: USER_QUIZZES_KEY });
    },
  });
}

// -----------------------------------------------------------------
// Admin — questions
// -----------------------------------------------------------------

export function useAddQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuestionInput) => quizzesAdminApi.addQuestion(quizId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'detail', quizId] });
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'list'] });
    },
  });
}

export function useUpdateQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, input }: { questionId: string; input: UpdateQuestionInput }) =>
      quizzesAdminApi.updateQuestion(questionId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'detail', quizId] });
    },
  });
}

export function useRemoveQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => quizzesAdminApi.removeQuestion(questionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'detail', quizId] });
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'list'] });
    },
  });
}

export function useReorderQuestions(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderQuestionsInput) =>
      quizzesAdminApi.reorderQuestions(quizId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...QUIZZES_KEY, 'detail', quizId] });
    },
  });
}

// -----------------------------------------------------------------
// Admin — submissions
// -----------------------------------------------------------------

export function useQuizSubmissions(quizId: string | null | undefined, query: Partial<SubmissionQuery> = {}) {
  return useQuery({
    queryKey: [...QUIZZES_KEY, 'submissions', quizId, query],
    queryFn: () => quizzesAdminApi.submissions(quizId!, query),
    enabled: !!quizId,
    placeholderData: (previous) => previous,
  });
}

// -----------------------------------------------------------------
// User (take + results)
// -----------------------------------------------------------------

export function useLessonQuizzes(lessonId: string | null | undefined) {
  return useQuery({
    queryKey: [...USER_QUIZZES_KEY, 'lesson', lessonId],
    queryFn: () => quizzesUserApi.listForLesson(lessonId!),
    enabled: !!lessonId,
  });
}

export function useMonitoringTests() {
  return useQuery({
    queryKey: [...USER_QUIZZES_KEY, 'monitoring'],
    queryFn: () => quizzesUserApi.listMonitoringTests(),
  });
}

export function useTakeQuiz(id: string | null | undefined) {
  return useQuery({
    queryKey: [...USER_QUIZZES_KEY, 'take', id],
    queryFn: () => quizzesUserApi.takeDetail(id!),
    enabled: !!id,
    // Savol tartibi fetchda qotirilsin — qayta fetchda tasodifiylik bo'lmasin.
    staleTime: Infinity,
  });
}

export function useSubmitQuiz(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitQuizInput) => quizzesUserApi.submit(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...USER_QUIZZES_KEY, 'my-history', id] });
    },
  });
}

export function useMyHistory(id: string | null | undefined) {
  return useQuery({
    queryKey: [...USER_QUIZZES_KEY, 'my-history', id],
    queryFn: () => quizzesUserApi.myHistory(id!),
    enabled: !!id,
  });
}

export function useMySubmission(submissionId: string | null | undefined) {
  return useQuery({
    queryKey: [...USER_QUIZZES_KEY, 'submission', submissionId],
    queryFn: () => quizzesUserApi.submissionDetail(submissionId!),
    enabled: !!submissionId,
  });
}
