import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from './ai-provider.interface';

/**
 * Anthropic Claude provayderi.
 *
 * API kalit + model + max tokens:
 *   1. `platform_settings` jadvalidan (DB) — SUPER_ADMIN UI orqali kiritgan
 *   2. `.env`dan — dev/prod boshlang'ich fallback
 * Ikkisi ham bo'lmasa `isConfigured()` false qaytaradi va endpoint 503 beradi.
 */
@Injectable()
export class AnthropicProvider implements AiProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settings: PlatformSettingsService,
  ) {}

  private async readConfig() {
    const [apiKey, model, maxTokensRaw] = await Promise.all([
      this.settings.getWithEnvFallback('AI_API_KEY', 'ANTHROPIC_API_KEY'),
      this.settings.getWithEnvFallback('AI_MODEL', 'AI_MODEL'),
      this.settings.getWithEnvFallback('AI_MAX_TOKENS', 'AI_MAX_TOKENS'),
    ]);
    return {
      apiKey: apiKey?.trim() || null,
      model: model?.trim() || 'claude-sonnet-4-5',
      maxTokens: Number(maxTokensRaw ?? 1024) || 1024,
    };
  }

  async isConfigured(): Promise<boolean> {
    const { apiKey } = await this.readConfig();
    return !!apiKey;
  }

  async sendMessage(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const { apiKey, model, maxTokens } = await this.readConfig();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI xizmati sozlanmagan. Iltimos, administrator bilan bog‘laning.',
      );
    }
    const client = new Anthropic({ apiKey });

    try {
      const response = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? maxTokens,
        system: req.system,
        messages: req.history.map((m) => ({ role: m.role, content: m.content })),
      });

      const textBlocks = response.content.filter(
        (block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text',
      );
      const text = textBlocks.map((b) => b.text).join('\n').trim();
      const tokens = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

      if (!text) {
        this.logger.warn(
          { model, id: response.id },
          'Anthropic returned empty text',
        );
        return {
          text: 'Kechirasiz, hozir javob berish qiyin bo‘lmoqda. Iltimos, qayta urinib ko‘ring.',
          tokens,
        };
      }

      return { text, tokens };
    } catch (err) {
      this.logger.error({ err }, 'Anthropic request failed');
      throw new ServiceUnavailableException(
        'AI xizmati vaqtincha ishlamayapti, keyinroq urinib ko‘ring.',
      );
    }
  }
}
