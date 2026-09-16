import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications', version: '1' })
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSION.NOTIFICATIONS_READ_OWN)
  @ApiOperation({ summary: 'Foydalanuvchining bildirishnomalari' })
  async list(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(200, Math.max(1, Number(limit))) : 50;
    const rows = await this.service.listForUser(userId, n);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      titleUz: r.titleUz,
      bodyUz: r.bodyUz,
      data: r.data,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Get('unread-count')
  @RequirePermissions(PERMISSION.NOTIFICATIONS_READ_OWN)
  @ApiOperation({ summary: "O'qilmagan bildirishnomalar soni" })
  async unread(@CurrentUser('id') userId: string) {
    const count = await this.service.unreadCount(userId);
    return { count };
  }

  @Patch('read')
  @RequirePermissions(PERMISSION.NOTIFICATIONS_READ_OWN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Berilgan bildirishnomalarni o'qilgan deb belgilash" })
  async markRead(
    @CurrentUser('id') userId: string,
    @Body() body: { ids?: string[] },
  ) {
    return this.service.markRead(userId, body.ids ?? []);
  }

  @Post('read-all')
  @RequirePermissions(PERMISSION.NOTIFICATIONS_READ_OWN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Barcha bildirishnomalarni o'qilgan deb belgilash" })
  async markAllRead(@CurrentUser('id') userId: string) {
    return this.service.markAllRead(userId);
  }
}
