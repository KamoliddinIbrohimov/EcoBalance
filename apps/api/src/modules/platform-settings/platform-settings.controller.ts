import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PlatformSettingsService } from './platform-settings.service';

// Bosh sahifa — "Ekologik monitoring" / "Ta'lim" kartalari fon rasmi.
const HOME_MEDIA_KEYS = {
  eco: 'home_card_eco_image',
  edu: 'home_card_edu_image',
} as const;
type HomeMediaCardKey = keyof typeof HOME_MEDIA_KEYS;
const HOME_MEDIA_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const HOME_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
// Multer darajasidagi qattiq chegara — bizning 5 MB tekshiruvimizdan biroz
// yuqori backstop, shunda aniq "5 MB dan oshmasligi kerak" xabarini BIZ
// o'zimiz chiqaramiz (multer'ning o'z xatosi emas).
const HOME_MEDIA_MULTER_LIMIT_BYTES = 8 * 1024 * 1024;
const HOME_MEDIA_TYPE_ERROR = "Faqat JPG, PNG yoki WebP yuklash mumkin";
const HOME_MEDIA_SIZE_ERROR = 'Rasm hajmi 5 MB dan oshmasligi kerak';

/**
 * Settings jadvalida `home_card_*_image` qiymati faqat object KEY (masalan
 * `home/eco-123.jpg`) sifatida saqlanadi — to'liq URL emas, shunda
 * PUBLIC_ASSET_ORIGIN o'zgarsa (domen/port) eski yozuvlar buzilmaydi
 * (rasm-tuzatish-prompt.md B bandi). Bu funksiya ESKI formatda (to'liq URL)
 * saqlangan qiymatlarni ham key'ga normalizatsiya qiladi — migratsiyasiz.
 */
function toPublicKey(stored: string): string {
  if (!stored.startsWith('http://') && !stored.startsWith('https://')) return stored;
  const afterHost = stored.replace(/^https?:\/\/[^/]+\//, '');
  const parts = afterHost.split('/');
  // birinchi segment bucket nomi edi (masalan "ecobalance-public") — qolgani key.
  return parts.slice(1).join('/');
}

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
  private readonly logger = new Logger(PlatformSettingsController.name);

  constructor(
    private readonly service: PlatformSettingsService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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

  @Get('home-media')
  // Bosh sahifa ("/") barcha kirgan foydalanuvchilarga ko'rinadi — rasm
  // manzillarini o'qish ochiq (faqat autentifikatsiya), YUKLASH esa pastda
  // faqat SUPER_ADMIN (ROLES_MANAGE) uchun.
  @ApiOperation({ summary: "Bosh sahifa kartalari uchun yuklangan rasm URL'lari" })
  async getHomeMedia() {
    const map = await this.service.getMany(Object.values(HOME_MEDIA_KEYS));
    const ecoKey = map[HOME_MEDIA_KEYS.eco];
    const eduKey = map[HOME_MEDIA_KEYS.edu];
    return {
      ecoImageUrl: ecoKey ? this.storage.getPublicUrl(toPublicKey(ecoKey)) : null,
      eduImageUrl: eduKey ? this.storage.getPublicUrl(toPublicKey(eduKey)) : null,
    };
  }

  @Post('home-media')
  @RequirePermissions(PERMISSION.ROLES_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: HOME_MEDIA_MULTER_LIMIT_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bosh sahifa kartasi uchun rasm yuklash (faqat SUPER_ADMIN)' })
  async uploadHomeMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body('cardKey') cardKey: string,
    @CurrentUser('id') actorId: string,
  ) {
    if (cardKey !== 'eco' && cardKey !== 'edu') {
      throw new BadRequestException("cardKey 'eco' yoki 'edu' bo'lishi kerak");
    }
    if (!file) {
      throw new BadRequestException('Fayl yuklanmadi');
    }
    // Server hech qachon klient tekshiruviga ishonmaydi — tur va hajm bu
    // yerda ham mustaqil tasdiqlanadi (rasm-tuzatish-prompt.md D bandi).
    const ext = HOME_MEDIA_MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(HOME_MEDIA_TYPE_ERROR);
    }
    if (file.size > HOME_MEDIA_MAX_BYTES) {
      throw new BadRequestException(HOME_MEDIA_SIZE_ERROR);
    }

    const settingKey = HOME_MEDIA_KEYS[cardKey as HomeMediaCardKey];
    const previousStored = await this.service.get(settingKey);

    const key = `home/${cardKey}-${Date.now()}.${ext}`;
    await this.storage.uploadPublic(key, file.buffer, file.mimetype);
    await this.service.set(settingKey, key, actorId);

    // Eski faylni MinIO'dan tozalash — "yetim" object qolmasin. Best-effort:
    // o'chirish muvaffaqiyatsiz bo'lsa ham yangi rasm allaqachon saqlangan va
    // sozlama yangilangan, shuning uchun foydalanuvchiga xato qaytarmaymiz.
    if (previousStored) {
      const previousKey = toPublicKey(previousStored);
      if (previousKey !== key) {
        this.storage.deletePublic(previousKey).catch((err: unknown) => {
          this.logger.warn(`Eski home-media faylini o'chirib bo'lmadi: ${previousKey}`, err);
        });
      }
    }

    return this.getHomeMedia();
  }
}
