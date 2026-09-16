/**
 * Provider-agnostic contract for chat completions. Swapping providers
 * (Anthropic → OpenAI → local model) should mean touching only the class
 * that implements this interface, never the callers.
 */
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  history: AiChatMessage[];
  system?: string;
  maxTokens?: number;
}

export interface AiCompletionResult {
  text: string;
  /** Kirim + chiqim token yig'indisi (billing statistikasi uchun). */
  tokens: number;
}

export interface AiProvider {
  /**
   * Returns the assistant's reply + token count. Throws on network/provider
   * errors; callers translate those into HTTP responses.
   */
  sendMessage(req: AiCompletionRequest): Promise<AiCompletionResult>;

  /**
   * True when the provider has valid credentials wired up (e.g. API key set
   * in the environment or platform settings). If false, callers should surface
   * a 503 rather than attempting an outbound call.
   */
  isConfigured(): Promise<boolean>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
