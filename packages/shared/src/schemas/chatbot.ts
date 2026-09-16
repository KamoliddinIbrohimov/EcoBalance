import { z } from 'zod';

import { paginationQuerySchema } from './pagination';

export const AI_MESSAGE_ROLE = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
} as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLE)[keyof typeof AI_MESSAGE_ROLE];

export const CHATBOT_MESSAGE_MAX = 4000;
export const CHATBOT_TITLE_MAX = 255;

export const aiMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.nativeEnum(AI_MESSAGE_ROLE),
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type AiMessageDto = z.infer<typeof aiMessageSchema>;

export const aiConversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AiConversationSummaryDto = z.infer<typeof aiConversationSummarySchema>;

export const aiConversationDetailSchema = aiConversationSummarySchema.extend({
  messages: z.array(aiMessageSchema),
});
export type AiConversationDetailDto = z.infer<typeof aiConversationDetailSchema>;

export const createConversationSchema = z.object({
  title: z.string().min(1).max(CHATBOT_TITLE_MAX).optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Xabar bo‘sh bo‘lmasligi kerak')
    .max(CHATBOT_MESSAGE_MAX, `Xabar ${CHATBOT_MESSAGE_MAX} belgidan oshmasligi kerak`),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const conversationQuerySchema = paginationQuerySchema;
export type ConversationQuery = z.infer<typeof conversationQuerySchema>;

export const sendMessageResponseSchema = z.object({
  conversation: aiConversationSummarySchema,
  userMessage: aiMessageSchema,
  assistantMessage: aiMessageSchema,
});
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
