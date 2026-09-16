import { apiClient } from '@/shared/lib/api-client';

export interface AiSettingsDto {
  config: {
    apiKey: string | null; // masked (may be null)
    apiKeySet: boolean;
    model: string;
    maxTokens: number;
    systemPrompt: string | null;
  };
  usage: {
    conversations: number;
    messagesTotal: number;
    tokensTotal: number;
    byRole: Array<{ role: 'USER' | 'ASSISTANT'; count: number; tokens: number }>;
    lastMessageAt: string | null;
  };
}

export interface UpdateAiSettingsInput {
  aiApiKey?: string;
  aiModel?: string;
  aiMaxTokens?: number;
  aiSystemPrompt?: string;
}

interface Envelope<T> {
  data: T;
}

export const aiSettingsApi = {
  async get(): Promise<AiSettingsDto> {
    const { data } = await apiClient.get<Envelope<AiSettingsDto>>('/settings/ai');
    return data.data;
  },
  async update(input: UpdateAiSettingsInput): Promise<AiSettingsDto> {
    const { data } = await apiClient.patch<Envelope<AiSettingsDto>>('/settings/ai', input);
    return data.data;
  },
};
