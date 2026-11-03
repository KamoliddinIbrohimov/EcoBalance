import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type HeartbeatInput,
  type LessonProgressUpdateInput,
  heartbeatSchema,
  lessonProgressUpdateSchema,
} from '@eco/shared';

import { ZBody } from '../../common/http/zod.pipe';
import { type Actor, CurrentActor, Roles } from '../auth/actor';
import { ProgressService } from './progress.service';

/**
 * `/lessons/...` prefiksi courses moduli bilan umumiy. `GET progress/me` uch
 * segmentli — courses'ning `GET :id` (bitta segment) unga mos kelmaydi, shuning
 * uchun modullar tartibidan qat'i nazar to'qnashuv yo'q (e2e test qo'riqlaydi).
 */
@Controller('lessons')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  /** Talaba bo'lmasa bo'sh ro'yxat. */
  @Get('progress/me')
  mine(@CurrentActor() actor: Actor) {
    return this.progress.mine(actor);
  }

  @Post(':id/progress')
  @Roles('STUDENT')
  @HttpCode(200)
  mark(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(lessonProgressUpdateSchema) body: LessonProgressUpdateInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.progress.mark(id, body.completed, actor);
  }

  @Post(':id/heartbeat')
  @Roles('STUDENT')
  @HttpCode(200)
  heartbeat(@Param('id', ParseUUIDPipe) id: string, @ZBody(heartbeatSchema) body: HeartbeatInput, @CurrentActor() actor: Actor) {
    return this.progress.heartbeat(id, body, actor);
  }
}
