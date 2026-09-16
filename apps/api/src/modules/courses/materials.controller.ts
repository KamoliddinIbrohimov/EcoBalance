import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { MaterialsService } from './materials.service';

@ApiTags('Course Materials')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
@UseGuards(PermissionsGuard)
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get('courses/:courseId/materials')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kursning darslik fayllari ro‘yxati' })
  async list(@Param('courseId') courseId: string) {
    return this.materials.listForCourse(courseId);
  }

  @Post('courses/:courseId/materials')
  @RequirePermissions(PERMISSION.MATERIALS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      // Multer darajasidagi qattiq chegara — 30 MB. Bu memoriyga yuklashdan
      // oldin ishga tushadi va DoS'ga qarshi asosiy himoya.
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Kursga (yoki uning darsiga) darslik fayl yuklash' })
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') actorId: string,
    @Query('lessonId') lessonId: string | undefined,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.materials.upload({
      courseId,
      lessonId,
      file,
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('materials/:id/download')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Faylni yuklab olish (short-lived signed URL qaytadi)' })
  async download(@Param('id') id: string) {
    return this.materials.getDownloadUrl(id);
  }

  @Delete('materials/:id')
  @RequirePermissions(PERMISSION.MATERIALS_MANAGE)
  @ApiOperation({ summary: 'Faylni o‘chirish' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.materials.remove(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}
