import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EcoReportsController } from './eco-reports.controller';
import { EcoReportsService } from './eco-reports.service';

@Module({
  imports: [AuthModule],
  controllers: [EcoReportsController],
  providers: [EcoReportsService],
  exports: [EcoReportsService],
})
export class EcoReportsModule {}
