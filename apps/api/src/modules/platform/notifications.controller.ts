import { Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { z } from 'zod';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, CurrentActor } from '../auth/actor';
import { NotificationsService } from './notifications.service';

/** Eski xatti-harakat: noto'g'ri `limit` 422 emas, chegaraga keltiriladi. */
const listQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .catch(50)
    .transform((n) => Math.min(200, Math.max(1, n))),
});

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(500).default([]),
});

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@ZQuery(listQuerySchema) q: z.infer<typeof listQuerySchema>, @CurrentActor() actor: Actor) {
    return this.notifications.list(actor.id, q.limit);
  }

  @Get('unread-count')
  unreadCount(@CurrentActor() actor: Actor) {
    return this.notifications.unreadCount(actor.id);
  }

  @Patch('read')
  markRead(@ZBody(markReadSchema) body: z.infer<typeof markReadSchema>, @CurrentActor() actor: Actor) {
    return this.notifications.markRead(actor.id, body.ids);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentActor() actor: Actor) {
    return this.notifications.markAllRead(actor.id);
  }
}
