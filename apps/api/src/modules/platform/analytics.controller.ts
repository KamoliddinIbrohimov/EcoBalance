import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';

import { ZQuery } from '../../common/http/zod.pipe';
import { Roles } from '../auth/actor';
import { AnalyticsService } from './analytics.service';

const auditQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .catch(20)
    .transform((n) => Math.min(100, Math.max(1, n))),
});

@Controller('analytics')
@Roles('SUPER_ADMIN')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('audit-recent')
  recentAudit(@ZQuery(auditQuerySchema) q: z.infer<typeof auditQuerySchema>) {
    return this.analytics.recentAudit(q.limit);
  }
}
