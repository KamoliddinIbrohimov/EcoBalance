import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';

import { AI_MESSAGES, AiUnavailableError } from '../ai-unavailable';
import { type AiCompletionRequest, type AiCompletionResult, type AiProvider, EMPTY_REPLY } from './ai-provider';

@Injectable()
export class AnthropicProvider implements AiProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    // Kalit SA UI'dan istalgan payt o'zgarishi mumkin — klient har so'rovda yaratiladi.
    const client = new Anthropic({ apiKey: req.apiKey, timeout: 60_000, maxRetries: 2 });
    try {
      const res = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.history,
      });
      const text = res.content
        .flatMap((b) => (b.type === 'text' ? [b.text] : []))
        .join('\n')
        .trim();
      const tokens = res.usage.input_tokens + res.usage.output_tokens;
      if (!text) this.logger.warn({ model: req.model, stop: res.stop_reason }, 'Anthropic bo‘sh javob qaytardi');
      return { text: text || EMPTY_REPLY, tokens };
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new AiUnavailableError(AI_MESSAGES.badKey);
      }
      this.logger.error({ err, model: req.model }, 'Anthropic so‘rovi muvaffaqiyatsiz');
      throw new AiUnavailableError(AI_MESSAGES.down);
    }
  }
}
