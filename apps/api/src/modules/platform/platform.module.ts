import { Module } from '@nestjs/common';

import { AiConfigService } from './ai-config.service';
import { AiSettingsService } from './ai-settings.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { HomeMediaService } from './home-media.service';
import { EcoReportsController, NewsController } from './legacy-content.controller';
import { LegacyContentService } from './legacy-content.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SettingsController } from './settings.controller';
import { PlatformSettingsService } from './settings.service';

/**
 * Platforma xizmatlari. Boshqa modullar `NotificationsService.notify()` ni,
 * chatbot esa `AiConfigService` ni shu moduldan oladi.
 */
@Module({
  controllers: [NotificationsController, SettingsController, AnalyticsController, EcoReportsController, NewsController],
  providers: [
    PlatformSettingsService,
    AiConfigService,
    AiSettingsService,
    HomeMediaService,
    NotificationsService,
    AnalyticsService,
    LegacyContentService,
  ],
  exports: [NotificationsService, PlatformSettingsService, AiConfigService],
})
export class PlatformModule {}
