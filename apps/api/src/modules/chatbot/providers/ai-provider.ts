import type { AiProviderName } from '../../platform/ai-config.service';

export interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  apiKey: string;
  model: string;
  maxTokens: number;
  system: string;
  /** Birinchi va oxirgi xabar — `user`, rollar navbatma-navbat. */
  history: AiTurn[];
}

export interface AiCompletionResult {
  text: string;
  /** Kirish + chiqish tokenlari (statistika uchun). */
  tokens: number;
}

/**
 * Provayder shartnomasi. Xatolarni `AiUnavailableError` sifatida tashlaydi
 * (aks holda AiService ularni umumiy 503 ga aylantiradi).
 */
export interface AiProvider {
  complete(req: AiCompletionRequest): Promise<AiCompletionResult>;
}

export type AiProviderRegistry = Record<AiProviderName, AiProvider>;

/** Testlar shu tokenni soxta provayder bilan almashtiradi. */
export const AI_PROVIDERS = Symbol('AI_PROVIDERS');

export const EMPTY_REPLY = 'Kechirasiz, hozir javob berish qiyin bo‘lmoqda. Iltimos, qayta urinib ko‘ring.';
