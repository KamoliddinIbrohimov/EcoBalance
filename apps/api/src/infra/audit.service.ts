import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from './prisma.service';

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  subjectType?: string;
  subjectId?: string;
  changes?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Audit yozuvi hech qachon asosiy amalni yiqitmaydi. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          changes: entry.changes,
          ipAddress: entry.ip?.slice(0, 45),
          userAgent: entry.userAgent?.slice(0, 500),
        },
      });
    } catch (err) {
      this.logger.error({ err, action: entry.action }, 'Audit yozilmadi');
    }
  }
}
