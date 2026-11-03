import { BadRequestException, Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ZBody } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { AiSettingsService, type UpdateAiSettingsInput, updateAiSettingsSchema } from './ai-settings.service';
import { HOME_MEDIA_MULTER_LIMIT, HomeMediaService, isCardKey } from './home-media.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly ai: AiSettingsService,
    private readonly homeMedia: HomeMediaService,
  ) {}

  @Get('ai')
  @Roles('SUPER_ADMIN')
  getAi() {
    return this.ai.view();
  }

  @Patch('ai')
  @Roles('SUPER_ADMIN')
  updateAi(
    @ZBody(updateAiSettingsSchema) body: UpdateAiSettingsInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.ai.update(body, actor, client);
  }

  /** Bosh sahifa har bir kirgan foydalanuvchiga ko'rinadi — o'qish ochiq. */
  @Get('home-media')
  getHomeMedia() {
    return this.homeMedia.get();
  }

  @Post('home-media')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HOME_MEDIA_MULTER_LIMIT } }))
  uploadHomeMedia(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('cardKey') cardKey: unknown,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    if (!isCardKey(cardKey)) throw new BadRequestException("cardKey 'eco' yoki 'edu' bo'lishi kerak");
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return this.homeMedia.upload(cardKey, file, actor, client);
  }
}
