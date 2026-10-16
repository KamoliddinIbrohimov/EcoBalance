import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import {
  AssignmentsController,
  LessonProgressController,
  StatsController,
} from './lms.controller';
import { LmsService } from './lms.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, StorageModule],
  controllers: [AssignmentsController, LessonProgressController, StatsController],
  providers: [LmsService],
  exports: [LmsService],
})
export class LmsModule {}
