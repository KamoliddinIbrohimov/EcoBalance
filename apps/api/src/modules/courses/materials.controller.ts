import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';

import { ZQuery } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { MATERIAL_MAX_BYTES, MaterialsService } from './materials.service';

const uploadQuerySchema = z.object({ lessonId: z.string().uuid().optional() });

@Controller()
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get('courses/:courseId/materials')
  list(@Param('courseId', ParseUUIDPipe) courseId: string, @CurrentActor() actor: Actor) {
    return this.materials.listForCourse(courseId, actor);
  }

  /** Multer limiti xotiraga yuklashdan oldin ishlaydi (oshsa 413). */
  @Post('courses/:courseId/materials')
  @Roles('SUPER_ADMIN', 'TEACHER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MATERIAL_MAX_BYTES } }))
  upload(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @ZQuery(uploadQuerySchema) q: { lessonId?: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.materials.upload(courseId, q.lessonId, file, actor, client);
  }

  @Get('materials/:id/download')
  download(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.materials.downloadUrl(id, actor);
  }

  @Delete('materials/:id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.materials.remove(id, actor, client);
  }
}
