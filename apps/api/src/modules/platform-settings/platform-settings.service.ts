import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';

/**
 * PlatformSettingsService — kalit-qiymatlarni DB'dan o'qish/yozish.
 * Aynan hozir AI provayder sozlamalarini boshqarish uchun kerak, lekin
 * kelajakda boshqa integratsiyalar ham shu jadvalga tushishi mumkin.
 */
@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: keys } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  async set(key: string, value: string, updatedBy?: string): Promise<void> {
    await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  /**
   * DB'da qiymat bo'lsa uni qaytaradi, aks holda .env'dan default oladi.
   * Kelajakda AI Service shu metod'ni chaqirib key va model'ni oladi.
   */
  async getWithEnvFallback(key: string, envName?: string): Promise<string | null> {
    const fromDb = await this.get(key);
    if (fromDb) return fromDb;
    if (envName) return this.config.get<string>(envName) ?? null;
    return null;
  }
}
