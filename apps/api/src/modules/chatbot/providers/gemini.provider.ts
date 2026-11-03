import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';

import { AI_MESSAGES, AiUnavailableError } from '../ai-unavailable';
import { type AiCompletionRequest, type AiCompletionResult, type AiProvider, EMPTY_REPLY } from './ai-provider';

/** Gemini free tier'da 503/429 tez-tez — qisqa eksponensial kutish bilan qayta urinamiz. */
const BACKOFF_MS = [0, 1000, 2000, 4000];

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const model = new GoogleGenerativeAI(req.apiKey).getGenerativeModel({
      model: req.model,
      systemInstruction: req.system,
      generationConfig: { maxOutputTokens: req.maxTokens },
    });
    const last = req.history[req.history.length - 1]!;
    const chat = model.startChat({
      history: req.history.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    let lastErr: unknown;
    for (const delay of BACKOFF_MS) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await chat.sendMessage(last.content);
        const text = res.response.text().trim();
        const usage = res.response.usageMetadata;
        const tokens = (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);
        if (!text) this.logger.warn({ model: req.model }, 'Gemini bo‘sh javob qaytardi');
        return { text: text || EMPTY_REPLY, tokens };
      } catch (err) {
        lastErr = err;
        const status = statusOf(err);
        if (status !== 503 && status !== 429) break;
      }
    }

    const status = statusOf(lastErr);
    this.logger.error({ err: lastErr, status, model: req.model }, 'Gemini so‘rovi muvaffaqiyatsiz');
    // 401/403 ni 401 qilib qaytarmaymiz: web klient uni sessiya tugadi deb tushunadi.
    throw new AiUnavailableError(status === 401 || status === 403 ? AI_MESSAGES.badKey : AI_MESSAGES.down);
  }
}

function statusOf(err: unknown): number | null {
  if (typeof err !== 'object' || !err) return null;
  const s = (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  if (typeof s === 'number') return s;
  const m = /\[(\d{3})\s/.exec((err as { message?: string }).message ?? '');
  return m ? Number(m[1]) : null;
}
