import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';

import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Controller({ path: 'analytics', version: '1' })
@UseGuards(PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  @RequirePermissions(PERMISSION.AUDIT_READ)
  @ApiOperation({ summary: 'Umumiy statistika — Dashboard/Analytics uchun' })
  async overview() {
    return this.service.overview();
  }

  @Get('audit-recent')
  @RequirePermissions(PERMISSION.AUDIT_READ)
  @ApiOperation({ summary: 'Audit log so‘nggi yozuvlari (Dashboard uchun)' })
  async recentAuditLogs(@Query('limit') limit?: string) {
    const n = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : 20;
    return this.service.recentAuditLogs(n);
  }
}
