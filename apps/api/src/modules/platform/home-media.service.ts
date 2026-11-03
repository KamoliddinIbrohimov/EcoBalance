import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { AuditService } from '../../infra/audit.service';
import { StorageService } from '../../infra/storage.service';
import type { Actor, ClientInfo } from '../auth/actor';
import { PlatformSettingsService } from './settings.service';

/** Bosh sahifadagi "Ekologik monitoring" / "Ta'lim" kartalari fon rasmi. */
const CARD_SETTING = { eco: 'home_card_eco_image', edu: 'home_card_edu_image' } as const;
export type HomeMediaCardKey = keyof typeof CARD_SETTING;

const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const HOME_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const HOME_MEDIA_MAX_WIDTH = 1600;
/** Multer chegarasi biroz yuqori — aniq "5 MB" xabarini o'zimiz beramiz. */
export const HOME_MEDIA_MULTER_LIMIT = 8 * 1024 * 1024;

export function isCardKey(v: unknown): v is HomeMediaCardKey {
  return v === 'eco' || v === 'edu';
}

@Injectable()
export class HomeMediaService {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const map = await this.settings.getMany(Object.values(CARD_SETTING));
    const url = (stored?: string) => (stored ? this.storage.publicUrl(this.toKey(stored)) : null);
    return { ecoImageUrl: url(map[CARD_SETTING.eco]), eduImageUrl: url(map[CARD_SETTING.edu]) };
  }

  async upload(cardKey: HomeMediaCardKey, file: Express.Multer.File, actor: Actor, client: ClientInfo) {
    const ext = MIME_EXT[file.mimetype];
    if (!ext) throw new BadRequestException('Faqat JPG, PNG yoki WebP yuklash mumkin');
    if (file.size > HOME_MEDIA_MAX_BYTES) throw new BadRequestException('Rasm hajmi 5 MB dan oshmasligi kerak');

    const settingKey = CARD_SETTING[cardKey];
    const previous = await this.settings.get(settingKey);
    // Bu rasm har bosh sahifa yuklanishida optimizatorsiz beriladi — shuning
    // uchun shu yerda 1600px WebP'ga kichraytiramiz (5 MB → odatda ~150–300 KB).
    const optimized = await sharp(file.buffer)
      .rotate()
      .resize({ width: HOME_MEDIA_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException('Rasmni o‘qib bo‘lmadi — fayl buzilgan bo‘lishi mumkin');
      });
    const key = `home/${cardKey}-${Date.now()}.webp`;

    await this.storage.put(key, optimized, 'image/webp', 'public');
    await this.settings.set(settingKey, key, actor.id);
    if (previous) {
      const previousKey = this.toKey(previous);
      if (previousKey !== key) await this.storage.remove(previousKey, 'public');
    }
    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      subjectType: 'PlatformSetting',
      changes: { keys: [settingKey] },
      ...client,
    });
    return this.get();
  }

  /**
   * DB'da faqat object key saqlanadi (domen o'zgarsa URL buzilmasin). Eski
   * yozuvlar to'liq URL bo'lishi mumkin — ular key'ga keltiriladi.
   */
  private toKey(stored: string): string {
    if (!/^https?:\/\//.test(stored)) return stored;
    return (
      this.storage.locate(stored)?.key ??
      stored.replace(/^https?:\/\/[^/]+\//, '').split('/').slice(1).join('/')
    );
  }
}
