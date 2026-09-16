import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoursesController, LessonsController } from './courses.controller';
import { CoursesService } from './courses.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CoursesController, LessonsController, MaterialsController],
  providers: [CoursesService, MaterialsService],
  exports: [CoursesService, MaterialsService],
})
export class CoursesModule {}
