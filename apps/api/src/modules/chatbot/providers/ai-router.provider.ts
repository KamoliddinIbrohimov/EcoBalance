import { Injectable, Logger } from '@nestjs/common';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from './ai-provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';

/**
 * Ko'p provayderli router — kalitning prefixi bo'yicha to'g'ri provayderni
 * tanlaydi. Foydalanuvchi UI'dan bironta kalit kiritsa yetadi — biz avtomatik
 * uni Claude yoki Gemini deb aniqlaymiz.
 *
 * Prefikslar:
 *   • `sk-ant-...`  → Anthropic (Claude)
 *   • `AIza...` yoki `AQ....` → Google Gemini
 *   • boshqa       → default Anthropic (o'zgarishi mumkin)
 */
@Injectable()
export class AiRouterProvider implements AiProvider {
  private readonly logger = new Logger(AiRouterProvider.name);

  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly anthropic: AnthropicProvider,
    private readonly gemini: GeminiProvider,
  ) {}

  private async pickProvider(): Promise<{ provider: AiProvider; name: string }> {
    const explicit = await this.settings.get('AI_PROVIDER');
    if (explicit === 'anthropic') return { provider: this.anthropic, name: 'anthropic' };
    if (explicit === 'gemini') return { provider: this.gemini, name: 'gemini' };

    // Auto-detect from key prefix
    const key = (await this.settings.getWithEnvFallback('AI_API_KEY', 'ANTHROPIC_API_KEY')) ?? '';
    if (key.startsWith('sk-ant-')) return { provider: this.anthropic, name: 'anthropic' };
    if (key.startsWith('AIza') || key.startsWith('AQ.')) {
      return { provider: this.gemini, name: 'gemini' };
    }
    // Gemini uchun alohida env
    const geminiEnv = await this.settings.getWithEnvFallback('AI_API_KEY', 'GEMINI_API_KEY');
    if (geminiEnv && (geminiEnv.startsWith('AIza') || geminiEnv.startsWith('AQ.'))) {
      return { provider: this.gemini, name: 'gemini' };
    }
    return { provider: this.anthropic, name: 'anthropic' };
  }

  async isConfigured(): Promise<boolean> {
    const { provider } = await this.pickProvider();
    return provider.isConfigured();
  }

  async sendMessage(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const { provider, name } = await this.pickProvider();
    this.logger.debug(`Routing chat request to provider=${name}`);
    return provider.sendMessage(req);
  }
}
