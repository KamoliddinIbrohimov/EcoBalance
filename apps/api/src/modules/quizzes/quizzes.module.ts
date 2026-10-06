import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QuizzesAdminController, QuizzesUserController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [QuizzesAdminController, QuizzesUserController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
