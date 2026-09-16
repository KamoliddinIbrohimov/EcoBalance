import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from './ai-provider.interface';

/**
 * Google Gemini provayderi.
 *
 * API kalit: `AI_API_KEY` (platform_settings) yoki `GEMINI_API_KEY` (.env).
 * Kalit `AQ.` yoki `AIza` bilan boshlansa Gemini deb aniqlanadi.
 *
 * Retry: 503 (yuklama) va 429 (rate limit) xatolari uchun exponential backoff
 * bilan avtomatik takrorlaymiz — Gemini free tier'da bu holatlar tez-tez uchraydi.
 */
@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settings: PlatformSettingsService,
  ) {}

  private async readConfig() {
    const [apiKey, model, maxTokensRaw] = await Promise.all([
      this.settings.getWithEnvFallback('AI_API_KEY', 'GEMINI_API_KEY'),
      this.settings.getWithEnvFallback('AI_MODEL', 'AI_MODEL'),
      this.settings.getWithEnvFallback('AI_MAX_TOKENS', 'AI_MAX_TOKENS'),
    ]);
    return {
      apiKey: apiKey?.trim() || null,
      // gemini-3.5-flash-lite — arzon, tez, free tier'da mavjud (flash-latest
      // bilan solishtirganda kamroq quotalar bilan cheklangan).
      model: model?.trim() || 'gemini-3.5-flash-lite',
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

    const client = new GoogleGenerativeAI(apiKey);
    const generative = client.getGenerativeModel({
      model,
      systemInstruction: req.system,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? maxTokens,
      },
    });

    const history = req.history.slice(0, -1);
    const lastUser = req.history[req.history.length - 1];
    if (!lastUser || lastUser.role !== 'user') {
      throw new Error('Last message must be a user message');
    }

    const chat = generative.startChat({
      history: history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    // Retry loop — 503 (overloaded) va 429 (rate limit) uchun eksponensial kutish.
    // 4 urinish: 0s → 2s → 4s → 8s. Boshqa xatolar darrov chiqadi.
    const MAX_ATTEMPTS = 4;
    const BACKOFF_MS = [0, 2000, 4000, 8000];
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (BACKOFF_MS[attempt] > 0) {
        this.logger.debug(
          `Gemini retry attempt ${attempt + 1}/${MAX_ATTEMPTS} after ${BACKOFF_MS[attempt]}ms`,
        );
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }
      try {
        const result = await chat.sendMessage(lastUser.content);
        const text = result.response.text().trim();
        const usage = result.response.usageMetadata;
        const tokens =
          (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

        if (!text) {
          this.logger.warn({ model }, 'Gemini returned empty text');
          return {
            text: 'Kechirasiz, hozir javob berish qiyin bo‘lmoqda. Iltimos, qayta urinib ko‘ring.',
            tokens,
          };
        }
        return { text, tokens };
      } catch (err) {
        lastErr = err;
        const status = this.extractStatus(err);
        // Retry qilinadigan holatlar: 503 overloaded, 429 rate limit.
        if (status === 503 || status === 429) {
          continue;
        }
        // Boshqa xatolar — hardware/config muammosi, darrov chiqamiz.
        break;
      }
    }

    // Barcha urinishlar tugadi yoki retry qilinmagan xato.
    const status = this.extractStatus(lastErr);
    this.logger.error(
      { err: lastErr, status },
      'Gemini request failed after retries',
    );

    // Foydalanuvchiga tushunarli xato
    if (status === 401 || status === 403) {
      throw new UnauthorizedException(
        'AI kaliti noto‘g‘ri yoki loyihaga Gemini API'.replace(
          "'",
          '‘',
        ) + ' ruxsat berilmagan. Sozlamalarni tekshiring.',
      );
    }
    if (status === 400) {
      throw new BadRequestException('AI so‘rov noto‘g‘ri tuzilgan.');
    }
    throw new ServiceUnavailableException(
      'AI xizmati vaqtincha ishlamayapti (Google server band). Bir necha soniyadan keyin qayta urining.',
    );
  }

  /** GoogleGenerativeAI xatolaridan HTTP status kodini ajratish. */
  private extractStatus(err: unknown): number | null {
    if (typeof err !== 'object' || !err) return null;
    // GoogleGenerativeAIFetchError'da .status yoki .statusCode maydoni bo'lishi mumkin
    const candidate =
      (err as { status?: number }).status ??
      (err as { statusCode?: number }).statusCode ??
      null;
    if (typeof candidate === 'number') return candidate;
    // Xato matni ichidan qidiramiz: "[503 Service Unavailable]"
    const message = (err as { message?: string }).message ?? '';
    const m = /\[(\d{3})\s/.exec(message);
    if (m) return Number(m[1]);
    return null;
  }
}
