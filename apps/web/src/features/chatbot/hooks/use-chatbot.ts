'use client';

import type {
  AiConversationDetailDto,
  ConversationQuery,
  CreateConversationInput,
  SendMessageInput,
  SendMessageResponse,
} from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chatbotApi } from '../api/chatbot-api';

const CHATBOT_KEY = ['chatbot'] as const;
const CONVERSATIONS_KEY = [...CHATBOT_KEY, 'conversations'] as const;

export function useConversations(query: Partial<ConversationQuery> = {}) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, 'list', query],
    queryFn: () => chatbotApi.listConversations(query),
    placeholderData: (previous) => previous,
  });
}

export function useConversation(id: string | null | undefined) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, 'detail', id],
    queryFn: () => chatbotApi.getConversation(id!),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConversationInput = {}) => chatbotApi.createConversation(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useRemoveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatbotApi.removeConversation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/**
 * Sends a message and optimistically appends both the user prompt and the
 * assistant reply to the cached conversation detail so the UI never blinks
 * when the request resolves.
 */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<
    SendMessageResponse,
    Error,
    { conversationId: string | null; input: SendMessageInput }
  >({
    mutationFn: ({ conversationId, input }) => chatbotApi.sendMessage(conversationId, input),
    onSuccess: (result) => {
      const conversationId = result.conversation.id;
      qc.setQueryData<AiConversationDetailDto | undefined>(
        [...CONVERSATIONS_KEY, 'detail', conversationId],
        (previous) => {
          const base = previous ?? {
            ...result.conversation,
            messages: [],
          };
          return {
            ...base,
            ...result.conversation,
            messages: [...base.messages, result.userMessage, result.assistantMessage],
          };
        },
      );
      void qc.invalidateQueries({ queryKey: [...CONVERSATIONS_KEY, 'list'] });
    },
  });
}
