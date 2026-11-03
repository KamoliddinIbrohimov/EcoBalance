import { Injectable } from '@nestjs/common';

import { type Env, InjectEnv } from '../../config/env';
import { PlatformSettingsService } from './settings.service';

export type AiProviderName = 'anthropic' | 'gemini';

/** `platform_settings` kalitlari (eski bazadagi nomlar — o'zgartirilmaydi). */
export const AI_SETTING = {
  apiKey: 'AI_API_KEY',
  provider: 'AI_PROVIDER',
  model: 'AI_MODEL',
  maxTokens: 'AI_MAX_TOKENS',
  systemPrompt: 'AI_SYSTEM_PROMPT',
} as const;

const DEFAULT_MODEL: Record<AiProviderName, string> = {
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-3.5-flash-lite',
};

export interface AiConfig {
  provider: AiProviderName;
  apiKey: string | null;
  model: string;
  maxTokens: number;
  /** Administrator kiritgan prompt; bo'lmasa chatbot o'zining standart promptini ishlatadi. */
  systemPrompt: string | null;
}

/** Kalit prefiksidan provayderni aniqlash: UI'da faqat bitta kalit maydoni bor. */
export function detectProvider(key: string): AiProviderName | null {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza') || key.startsWith('AQ.')) return 'gemini';
  return null;
}

/**
 * AI sozlamalari: avval DB (SA UI orqali kiritgan), keyin env. Chatbot ham,
 * Sozlamalar sahifasi ham shu yagona manbadan o'qiydi.
 */
@Injectable()
export class AiConfigService {
  constructor(
    private readonly settings: PlatformSettingsService,
    @InjectEnv() private readonly env: Env,
  ) {}

  async resolve(): Promise<AiConfig> {
    const s = await this.settings.getMany(Object.values(AI_SETTING));
    const dbKey = s[AI_SETTING.apiKey]?.trim() || null;
    const explicit = s[AI_SETTING.provider];
    const provider: AiProviderName =
      explicit === 'anthropic' || explicit === 'gemini'
        ? explicit
        : ((dbKey ? detectProvider(dbKey) : null) ?? this.envProvider());

    const model = s[AI_SETTING.model]?.trim() || this.env.AI_MODEL;
    const maxTokens = Number(s[AI_SETTING.maxTokens]);

    return {
      provider,
      apiKey: dbKey ?? this.envKey(provider),
      // env'dagi standart model boshqa provayderniki bo'lishi mumkin (claude-* + Gemini kaliti).
      model: this.fits(provider, model) ? model : DEFAULT_MODEL[provider],
      maxTokens: Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : this.env.AI_MAX_TOKENS,
      systemPrompt: s[AI_SETTING.systemPrompt]?.trim() || this.env.AI_SYSTEM_PROMPT?.trim() || null,
    };
  }

  /** env AI_PROVIDER'ning kaliti bo'lmasa, kaliti bor boshqa provayder tanlanadi. */
  private envProvider(): AiProviderName {
    const preferred = this.env.AI_PROVIDER;
    if (this.envKey(preferred)) return preferred;
    const other: AiProviderName = preferred === 'anthropic' ? 'gemini' : 'anthropic';
    return this.envKey(other) ? other : preferred;
  }

  private envKey(provider: AiProviderName): string | null {
    const key = provider === 'anthropic' ? this.env.ANTHROPIC_API_KEY : this.env.GEMINI_API_KEY;
    return key?.trim() || null;
  }

  private fits(provider: AiProviderName, model: string): boolean {
    return provider === 'anthropic' ? !model.startsWith('gemini') : !model.startsWith('claude');
  }
}
