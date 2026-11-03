import { Module } from '@nestjs/common';

import { PlatformModule } from '../platform/platform.module';
import { AiService } from './ai.service';
import { ChatService } from './chat.service';
import { ChatbotController } from './chatbot.controller';
import { ConversationsService } from './conversations.service';
import { KnowledgeService } from './knowledge.service';
import { AI_PROVIDERS, type AiProviderRegistry } from './providers/ai-provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [PlatformModule],
  controllers: [ChatbotController],
  providers: [
    ConversationsService,
    ChatService,
    KnowledgeService,
    AiService,
    AnthropicProvider,
    GeminiProvider,
    {
      provide: AI_PROVIDERS,
      useFactory: (anthropic: AnthropicProvider, gemini: GeminiProvider): AiProviderRegistry => ({ anthropic, gemini }),
      inject: [AnthropicProvider, GeminiProvider],
    },
  ],
  exports: [KnowledgeService],
})
export class ChatbotModule {}
