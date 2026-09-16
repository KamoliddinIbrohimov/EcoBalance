import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EducationLevelsController } from './education-levels.controller';
import { EducationLevelsService } from './education-levels.service';

@Module({
  imports: [AuthModule],
  controllers: [EducationLevelsController],
  providers: [EducationLevelsService],
  exports: [EducationLevelsService],
})
export class EducationLevelsModule {}
