import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { ZQuery } from '../../common/http/zod.pipe';
import { type Actor, CurrentActor, Roles } from '../auth/actor';
import { StatsService, type TimelineQuery, timelineQuerySchema } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /** Talaba bo'lmasa yoki guruhi yo'q bo'lsa `{data: null}`. */
  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return this.stats.me(actor);
  }

  @Get('groups/:id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  group(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.stats.group(id, actor);
  }

  @Get('groups/:id/students')
  @Roles('SUPER_ADMIN', 'TEACHER')
  groupStudents(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.stats.groupStudents(id, actor);
  }

  /** Talaba o'zinikini ham shu yo'l bilan oladi (/stats/me sahifasi). */
  @Get('students/:id/overview')
  overview(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.stats.studentOverview(id, actor);
  }

  @Get('students/:id/timeline')
  timeline(
    @Param('id', ParseUUIDPipe) id: string,
    @ZQuery(timelineQuerySchema) q: TimelineQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.stats.timeline(id, q, actor);
  }
}
