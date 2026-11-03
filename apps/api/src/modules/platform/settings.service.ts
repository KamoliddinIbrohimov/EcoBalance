import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.service';

/** `platform_settings` kalit-qiymat jadvali (AI sozlamalari, bosh sahifa rasmlari). */
@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async set(key: string, value: string, updatedBy?: string): Promise<void> {
    await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  /** Qiymatni o'chiradi — o'qishda env'dagi default qaytadi. */
  async unset(key: string): Promise<void> {
    await this.prisma.platformSetting.deleteMany({ where: { key } });
  }
}
