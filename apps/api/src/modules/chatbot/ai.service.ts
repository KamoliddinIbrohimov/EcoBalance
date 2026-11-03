import { Inject, Injectable, Logger } from '@nestjs/common';

import { type AiConfig, AiConfigService } from '../platform/ai-config.service';
import { AI_MESSAGES, AiUnavailableError } from './ai-unavailable';
import { AI_PROVIDERS, type AiCompletionResult, type AiProviderRegistry, type AiTurn } from './providers/ai-provider';

export type ReadyAiConfig = AiConfig & { apiKey: string };

/** Sozlamalardan provayderni tanlaydi va chaqiradi; har qanday nosozlik — 503. */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: AiConfigService,
    @Inject(AI_PROVIDERS) private readonly providers: AiProviderRegistry,
  ) {}

  /** Kalit yo'q bo'lsa hech narsa yozilmasidan oldin 503. */
  async ready(): Promise<ReadyAiConfig> {
    const cfg = await this.config.resolve();
    if (!cfg.apiKey) throw new AiUnavailableError(AI_MESSAGES.notConfigured);
    return cfg as ReadyAiConfig;
  }

  async complete(cfg: ReadyAiConfig, system: string, history: AiTurn[]): Promise<AiCompletionResult> {
    try {
      return await this.providers[cfg.provider].complete({
        apiKey: cfg.apiKey,
        model: cfg.model,
        maxTokens: cfg.maxTokens,
        system,
        history,
      });
    } catch (err) {
      if (err instanceof AiUnavailableError) throw err;
      this.logger.error({ err, provider: cfg.provider }, 'AI provayder xatosi');
      throw new AiUnavailableError(AI_MESSAGES.down);
    }
  }
}
