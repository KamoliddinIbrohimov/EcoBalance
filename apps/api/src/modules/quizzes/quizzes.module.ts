import { Module } from '@nestjs/common';

import { AttemptsService } from './attempts.service';
import { QuestionsService } from './questions.service';
import { MyQuizzesController, QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { SubmissionEffectsService } from './submission-effects.service';

@Module({
  controllers: [QuizzesController, MyQuizzesController],
  providers: [QuizzesService, QuestionsService, AttemptsService, SubmissionEffectsService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
