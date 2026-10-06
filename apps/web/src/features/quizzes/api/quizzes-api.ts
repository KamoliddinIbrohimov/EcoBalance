import type {
  CreateQuestionInput,
  CreateQuizInput,
  QuizAdminDetailDto,
  QuizPublicDetailDto,
  QuizQuery,
  QuizQuestionAdminDto,
  QuizSubmissionDetailDto,
  QuizSubmissionSummaryDto,
  QuizSubmissionWithUserDto,
  QuizSummaryDto,
  ReorderQuestionsInput,
  SubmissionQuery,
  SubmitQuizInput,
  UpdateQuestionInput,
  UpdateQuizInput,
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

// -----------------------------------------------------------------
// Admin API (QUIZZES_MANAGE)
// -----------------------------------------------------------------

export const quizzesAdminApi = {
  async list(query: Partial<QuizQuery>): Promise<PaginatedResult<QuizSummaryDto>> {
    const { data } = await apiClient.get<PaginatedResult<QuizSummaryDto>>('/quizzes', {
      params: toQueryParams(query),
    });
    return data;
  },

  async detail(id: string): Promise<QuizAdminDetailDto> {
    const { data } = await apiClient.get<Envelope<QuizAdminDetailDto>>(`/quizzes/${id}`);
    return data.data;
  },

  async create(input: CreateQuizInput): Promise<QuizSummaryDto> {
    const { data } = await apiClient.post<Envelope<QuizSummaryDto>>('/quizzes', input);
    return data.data;
  },

  async update(id: string, input: UpdateQuizInput): Promise<QuizSummaryDto> {
    const { data } = await apiClient.patch<Envelope<QuizSummaryDto>>(`/quizzes/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/quizzes/${id}`);
  },

  async addQuestion(quizId: string, input: CreateQuestionInput): Promise<QuizQuestionAdminDto> {
    const { data } = await apiClient.post<Envelope<QuizQuestionAdminDto>>(
      `/quizzes/${quizId}/questions`,
      input,
    );
    return data.data;
  },

  async updateQuestion(
    questionId: string,
    input: UpdateQuestionInput,
  ): Promise<QuizQuestionAdminDto> {
    const { data } = await apiClient.patch<Envelope<QuizQuestionAdminDto>>(
      `/quizzes/questions/${questionId}`,
      input,
    );
    return data.data;
  },

  async removeQuestion(questionId: string): Promise<void> {
    await apiClient.delete(`/quizzes/questions/${questionId}`);
  },

  async reorderQuestions(quizId: string, input: ReorderQuestionsInput): Promise<void> {
    await apiClient.patch(`/quizzes/${quizId}/questions/reorder`, input);
  },

  async submissions(
    quizId: string,
    query: Partial<SubmissionQuery>,
  ): Promise<PaginatedResult<QuizSubmissionWithUserDto>> {
    const { data } = await apiClient.get<PaginatedResult<QuizSubmissionWithUserDto>>(
      `/quizzes/${quizId}/submissions`,
      { params: toQueryParams(query) },
    );
    return data;
  },
};

// -----------------------------------------------------------------
// User API (QUIZZES_TAKE) — mounted under /my-quizzes
// -----------------------------------------------------------------

export const quizzesUserApi = {
  async listForLesson(lessonId: string): Promise<QuizSummaryDto[]> {
    const { data } = await apiClient.get<Envelope<QuizSummaryDto[]>>(
      `/my-quizzes/by-lesson/${lessonId}`,
    );
    return data.data;
  },

  async listMonitoringTests(): Promise<QuizSummaryDto[]> {
    const { data } = await apiClient.get<Envelope<QuizSummaryDto[]>>('/my-quizzes/ekologik');
    return data.data;
  },

  async takeDetail(id: string): Promise<QuizPublicDetailDto> {
    const { data } = await apiClient.get<Envelope<QuizPublicDetailDto>>(`/my-quizzes/${id}/take`);
    return data.data;
  },

  async submit(id: string, input: SubmitQuizInput): Promise<QuizSubmissionSummaryDto> {
    const { data } = await apiClient.post<Envelope<QuizSubmissionSummaryDto>>(
      `/my-quizzes/${id}/submissions`,
      input,
    );
    return data.data;
  },

  async myHistory(id: string): Promise<QuizSubmissionSummaryDto[]> {
    const { data } = await apiClient.get<Envelope<QuizSubmissionSummaryDto[]>>(
      `/my-quizzes/${id}/my-submissions`,
    );
    return data.data;
  },

  async submissionDetail(submissionId: string): Promise<QuizSubmissionDetailDto> {
    const { data } = await apiClient.get<Envelope<QuizSubmissionDetailDto>>(
      `/my-quizzes/submissions/${submissionId}`,
    );
    return data.data;
  },
};
