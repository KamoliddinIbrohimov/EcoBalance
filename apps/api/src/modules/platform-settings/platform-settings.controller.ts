import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

// Zod sxema — AI sozlamalari
const aiSettingsInputSchema = z.object({
  aiApiKey: z.string().min(1).optional(),
  aiModel: z.string().min(1).max(120).optional(),
  aiMaxTokens: z.coerce.number().int().positive().max(64_000).optional(),
  aiSystemPrompt: z.string().max(4000).optional(),
});
class AiSettingsDto extends createZodDto(aiSettingsInputSchema) {}

/** Kalitlarni maskalash — API kalitini brauzerga to'liq qaytarmaymiz. */
function mask(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 12) return '••••••••';
  return `${trimmed.slice(0, 6)}${'•'.repeat(20)}${trimmed.slice(-4)}`;
}

@ApiTags('Platform Settings')
@ApiBearerAuth('access-token')
@Controller({ path: 'settings', version: '1' })
@UseGuards(PermissionsGuard)
export class PlatformSettingsController {
  constructor(
    private readonly service: PlatformSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('ai')
  // Faqat SUPER_ADMIN — ROLES_MANAGE ruxsati SUPER_ADMIN'ga tegishli.
  @RequirePermissions(PERMISSION.ROLES_MANAGE)
  @ApiOperation({ summary: 'AI sozlamalarini olish + statistika' })
  async getAi() {
    const [key, model, maxTokens, systemPrompt] = await Promise.all([
      this.service.getWithEnvFallback('AI_API_KEY', 'ANTHROPIC_API_KEY'),
      this.service.getWithEnvFallback('AI_MODEL', 'AI_MODEL'),
      this.service.getWithEnvFallback('AI_MAX_TOKENS', 'AI_MAX_TOKENS'),
      this.service.getWithEnvFallback('AI_SYSTEM_PROMPT', 'AI_SYSTEM_PROMPT'),
    ]);

    // Statistika: chatbot foydalanuvchi/xabar/token soni
    const [conversations, messagesAgg, tokensAgg, byRole, lastMessage] = await Promise.all([
      this.prisma.aiConversation.count(),
      this.prisma.aiMessage.count(),
      this.prisma.aiMessage.aggregate({ _sum: { tokens: true } }),
      this.prisma.aiMessage.groupBy({
        by: ['role'],
        _count: { _all: true },
        _sum: { tokens: true },
      }),
      this.prisma.aiMessage.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      config: {
        apiKey: mask(key),
        apiKeySet: !!key,
        model: model ?? 'claude-sonnet-4-5',
        maxTokens: Number(maxTokens ?? 1024),
        systemPrompt: systemPrompt ?? null,
      },
      usage: {
        conversations,
        messagesTotal: messagesAgg,
        tokensTotal: tokensAgg._sum.tokens ?? 0,
        byRole: byRole.map((r) => ({
          role: r.role,
          count: (r._count as { _all: number })._all,
          tokens: r._sum.tokens ?? 0,
        })),
        lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      },
    };
  }

  @Patch('ai')
  @RequirePermissions(PERMISSION.ROLES_MANAGE)
  @ApiOperation({ summary: 'AI sozlamalarini yangilash' })
  async updateAi(
    @Body() dto: AiSettingsDto,
    @CurrentUser('id') actorId: string,
  ) {
    const updates: Array<[string, string]> = [];
    if (dto.aiApiKey && dto.aiApiKey.trim().length > 0) updates.push(['AI_API_KEY', dto.aiApiKey.trim()]);
    if (dto.aiModel) updates.push(['AI_MODEL', dto.aiModel]);
    if (dto.aiMaxTokens !== undefined) updates.push(['AI_MAX_TOKENS', String(dto.aiMaxTokens)]);
    if (dto.aiSystemPrompt !== undefined) updates.push(['AI_SYSTEM_PROMPT', dto.aiSystemPrompt]);

    for (const [k, v] of updates) {
      await this.service.set(k, v, actorId);
    }

    return this.getAi();
  }
}
