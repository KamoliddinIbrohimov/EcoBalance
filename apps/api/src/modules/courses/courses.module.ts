import { Module } from '@nestjs/common';

import { CourseAccess } from './course-access.service';
import { CoursesController, LessonsController } from './courses.controller';
import { CoursesService } from './courses.service';
import { LessonsService } from './lessons.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';

/** Oliy ta'lim kurslari, darslar, modullar, kurs materiallari. */
@Module({
  controllers: [CoursesController, LessonsController, ModulesController, MaterialsController],
  providers: [CourseAccess, CoursesService, LessonsService, ModulesService, MaterialsService],
  // CourseAccess — groups/learning modullari uchun umumiy ko'rinish siyosati.
  exports: [CourseAccess],
})
export class CoursesModule {}
