import { Module } from '@nestjs/common';

import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { GradingService } from './grading.service';
import { LearningAccess } from './learning-access.service';
import { LearningNotifier } from './learning-notifier';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { SubmissionsService } from './submissions.service';

/** Topshiriqlar, javoblar va baholash, dars progressi, statistika. */
@Module({
  controllers: [AssignmentsController, ProgressController, StatsController],
  providers: [
    LearningAccess,
    LearningNotifier,
    AssignmentsService,
    SubmissionsService,
    GradingService,
    ProgressService,
    StatsService,
  ],
})
export class LearningModule {}
