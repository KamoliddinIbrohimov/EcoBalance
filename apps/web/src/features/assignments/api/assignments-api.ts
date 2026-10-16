import type {
  AssignmentDto,
  AssignmentSubmissionDto,
  AssignmentSubmissionWithStudentDto,
  CreateAssignmentInput,
  GradeAssignmentInput,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from '@eco/shared';

import { apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export const assignmentsApi = {
  async list(): Promise<Paginated<AssignmentDto>> {
    const { data } = await apiClient.get<Paginated<AssignmentDto>>('/assignments', {
      params: { page: 1, perPage: 100 },
    });
    return data;
  },

  async create(input: CreateAssignmentInput): Promise<AssignmentDto> {
    const { data } = await apiClient.post<Envelope<AssignmentDto>>('/assignments', input);
    return data.data;
  },

  async update(id: string, input: UpdateAssignmentInput): Promise<AssignmentDto> {
    const { data } = await apiClient.patch<Envelope<AssignmentDto>>(`/assignments/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/assignments/${id}`);
  },

  async submit(id: string, input: SubmitAssignmentInput): Promise<AssignmentSubmissionDto> {
    const { data } = await apiClient.post<Envelope<AssignmentSubmissionDto>>(
      `/assignments/${id}/submissions`,
      input,
    );
    return data.data;
  },

  async mySubmission(id: string): Promise<AssignmentSubmissionDto | null> {
    const { data } = await apiClient.get<Envelope<AssignmentSubmissionDto | null>>(
      `/assignments/${id}/my-submission`,
    );
    return data.data;
  },

  async submissions(id: string): Promise<AssignmentSubmissionWithStudentDto[]> {
    const { data } = await apiClient.get<Envelope<AssignmentSubmissionWithStudentDto[]>>(
      `/assignments/${id}/submissions`,
    );
    return data.data;
  },

  async grade(submissionId: string, input: GradeAssignmentInput): Promise<AssignmentSubmissionDto> {
    const { data } = await apiClient.patch<Envelope<AssignmentSubmissionDto>>(
      `/assignments/submissions/${submissionId}/grade`,
      input,
    );
    return data.data;
  },

  async startTimed(id: string): Promise<AssignmentSubmissionDto> {
    const { data } = await apiClient.post<Envelope<AssignmentSubmissionDto>>(
      `/assignments/${id}/start`,
      {},
    );
    return data.data;
  },

  async reopen(submissionId: string, feedbackUz?: string): Promise<AssignmentSubmissionDto> {
    const { data } = await apiClient.post<Envelope<AssignmentSubmissionDto>>(
      `/assignments/submissions/${submissionId}/reopen`,
      { feedbackUz },
    );
    return data.data;
  },

  async uploadAttachment(id: string, file: File): Promise<{ key: string; fileName: string }> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await apiClient.post<Envelope<{ key: string; fileName: string }>>(
      `/assignments/${id}/attachment`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async attachmentUrl(id: string): Promise<{ url: string }> {
    const { data } = await apiClient.get<Envelope<{ url: string }>>(
      `/assignments/${id}/attachment-url`,
    );
    return data.data;
  },

  async submitFile(id: string, file: File): Promise<AssignmentSubmissionDto> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await apiClient.post<Envelope<AssignmentSubmissionDto>>(
      `/assignments/${id}/submissions/file`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async submissionFileUrl(submissionId: string): Promise<{ url: string }> {
    const { data } = await apiClient.get<Envelope<{ url: string }>>(
      `/assignments/submissions/${submissionId}/file-url`,
    );
    return data.data;
  },
};
