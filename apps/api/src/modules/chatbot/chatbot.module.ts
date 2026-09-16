import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { AiRouterProvider } from './providers/ai-router.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [AuthModule, PlatformSettingsModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    AnthropicProvider,
    GeminiProvider,
    AiRouterProvider,
    { provide: AI_PROVIDER, useExisting: AiRouterProvider },
  ],
  exports: [ChatbotService],
})
export class ChatbotModule {}
