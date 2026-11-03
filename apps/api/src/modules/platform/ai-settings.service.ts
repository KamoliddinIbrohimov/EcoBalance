import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AuditService } from '../../infra/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import type { Actor, ClientInfo } from '../auth/actor';
import { AI_SETTING, AiConfigService } from './ai-config.service';
import { PlatformSettingsService } from './settings.service';

export const updateAiSettingsSchema = z.object({
  aiApiKey: z.string().max(500).optional(),
  aiModel: z.string().trim().min(1).max(120).optional(),
  aiMaxTokens: z.coerce.number().int().positive().max(64_000).optional(),
  /** Bo'sh satr — standart promptga qaytarish. */
  aiSystemPrompt: z.string().max(4000).optional(),
});
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;

/** API kaliti brauzerga hech qachon to'liq qaytmaydi. */
function mask(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 12) return '••••••••';
  return `${value.slice(0, 6)}${'•'.repeat(20)}${value.slice(-4)}`;
}

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
    private readonly aiConfig: AiConfigService,
    private readonly audit: AuditService,
  ) {}

  async view() {
    const config = await this.aiConfig.resolve();
    const [conversations, messagesTotal, tokens, byRole, last] = await Promise.all([
      this.prisma.aiConversation.count(),
      this.prisma.aiMessage.count(),
      this.prisma.aiMessage.aggregate({ _sum: { tokens: true } }),
      this.prisma.aiMessage.groupBy({ by: ['role'], _count: { _all: true }, _sum: { tokens: true } }),
      this.prisma.aiMessage.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    return {
      config: {
        apiKey: mask(config.apiKey),
        apiKeySet: !!config.apiKey,
        provider: config.provider,
        model: config.model,
        maxTokens: config.maxTokens,
        systemPrompt: config.systemPrompt,
      },
      usage: {
        conversations,
        messagesTotal,
        tokensTotal: tokens._sum.tokens ?? 0,
        byRole: byRole.map((r) => ({ role: r.role, count: r._count._all, tokens: r._sum.tokens ?? 0 })),
        lastMessageAt: last?.createdAt.toISOString() ?? null,
      },
    };
  }

  async update(input: UpdateAiSettingsInput, actor: Actor, client: ClientInfo) {
    const changed: string[] = [];
    const set = async (key: string, value: string) => {
      await this.settings.set(key, value, actor.id);
      changed.push(key);
    };

    const apiKey = input.aiApiKey?.trim();
    if (apiKey) await set(AI_SETTING.apiKey, apiKey);
    if (input.aiModel) await set(AI_SETTING.model, input.aiModel);
    if (input.aiMaxTokens !== undefined) await set(AI_SETTING.maxTokens, String(input.aiMaxTokens));
    if (input.aiSystemPrompt !== undefined) {
      const prompt = input.aiSystemPrompt.trim();
      if (prompt) await set(AI_SETTING.systemPrompt, prompt);
      else {
        await this.settings.unset(AI_SETTING.systemPrompt);
        changed.push(AI_SETTING.systemPrompt);
      }
    }

    if (changed.length > 0) {
      // Faqat kalit nomlari — qiymatlar (ayniqsa API kaliti) auditga yozilmaydi.
      await this.audit.record({
        userId: actor.id,
        action: 'UPDATE',
        subjectType: 'PlatformSetting',
        changes: { keys: changed },
        ...client,
      });
    }
    return this.view();
  }
}
