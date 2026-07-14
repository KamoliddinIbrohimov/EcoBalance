import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service';

export interface AuditContext {
  userId?: string | null;
  action: AuditAction;
  subjectType?: string;
  subjectId?: string;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit log write; never throws to the caller. */
  async record(ctx: AuditContext): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: uuidv7(),
          userId: ctx.userId ?? null,
          action: ctx.action,
          subjectType: ctx.subjectType,
          subjectId: ctx.subjectId,
          changes: ctx.changes,
          ipAddress: ctx.ipAddress?.slice(0, 45),
          userAgent: ctx.userAgent?.slice(0, 500),
        },
      });
    } catch (err) {
      this.logger.error({ err, ctx }, 'Failed to write audit log');
    }
  }
}
