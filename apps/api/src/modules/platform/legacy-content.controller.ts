import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { type EcoReportQuery, type NewsQuery, ecoReportQuerySchema, newsQuerySchema } from '@eco/shared';

import { ZQuery } from '../../common/http/zod.pipe';
import { type Actor, CurrentActor, Roles } from '../auth/actor';
import { LegacyContentService } from './legacy-content.service';

@Controller('eco-reports')
@Roles('SUPER_ADMIN')
export class EcoReportsController {
  constructor(private readonly content: LegacyContentService) {}

  @Get()
  list(@ZQuery(ecoReportQuerySchema) q: EcoReportQuery) {
    return this.content.ecoReports(q);
  }
}

@Controller('news')
export class NewsController {
  constructor(private readonly content: LegacyContentService) {}

  @Get()
  list(@ZQuery(newsQuerySchema) q: NewsQuery, @CurrentActor() actor: Actor) {
    return this.content.news(q, actor);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.content.newsItem(id, actor);
  }
}
