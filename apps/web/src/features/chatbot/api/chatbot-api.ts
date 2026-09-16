import type {
  AiConversationDetailDto,
  AiConversationSummaryDto,
  ConversationQuery,
  CreateConversationInput,
  SendMessageInput,
  SendMessageResponse,
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

export const chatbotApi = {
  async listConversations(
    query: Partial<ConversationQuery>,
  ): Promise<PaginatedResult<AiConversationSummaryDto>> {
    const { data } = await apiClient.get<PaginatedResult<AiConversationSummaryDto>>(
      '/chatbot/conversations',
      { params: toQueryParams(query) },
    );
    return data;
  },

  async getConversation(id: string): Promise<AiConversationDetailDto> {
    const { data } = await apiClient.get<Envelope<AiConversationDetailDto>>(
      `/chatbot/conversations/${id}`,
    );
    return data.data;
  },

  async createConversation(input: CreateConversationInput): Promise<AiConversationSummaryDto> {
    const { data } = await apiClient.post<Envelope<AiConversationSummaryDto>>(
      '/chatbot/conversations',
      input,
    );
    return data.data;
  },

  async removeConversation(id: string): Promise<void> {
    await apiClient.delete(`/chatbot/conversations/${id}`);
  },

  async sendMessage(
    conversationId: string | null,
    input: SendMessageInput,
  ): Promise<SendMessageResponse> {
    if (conversationId) {
      const { data } = await apiClient.post<Envelope<SendMessageResponse>>(
        `/chatbot/conversations/${conversationId}/messages`,
        input,
      );
      return data.data;
    }
    const { data } = await apiClient.post<Envelope<SendMessageResponse>>(
      '/chatbot/messages',
      input,
    );
    return data.data;
  },
};
