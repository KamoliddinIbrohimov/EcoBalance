import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PERMISSION,
  createNewsSchema,
  newsQuerySchema,
  updateNewsSchema,
} from '@eco/shared';
import { createZodDto } from 'nestjs-zod';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { NewsService } from './news.service';

class CreateNewsDto extends createZodDto(createNewsSchema) {}
class UpdateNewsDto extends createZodDto(updateNewsSchema) {}
class NewsQueryDto extends createZodDto(newsQuerySchema) {}

@ApiTags('News')
@ApiBearerAuth('access-token')
@Controller({ path: 'news', version: '1' })
@UseGuards(PermissionsGuard)
export class NewsController {
  constructor(private readonly service: NewsService) {}

  @Get()
  @RequirePermissions(PERMISSION.NEWS_READ)
  @ApiOperation({ summary: "Yangiliklar ro'yxati (pagination + filter)" })
  async list(@Query() query: NewsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.NEWS_READ)
  @ApiOperation({ summary: 'Bitta yangilik' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSION.NEWS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi yangilik yaratish (ixtiyoriy fayl)' })
  async create(
    @Body() dto: CreateNewsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.create(dto, file, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.NEWS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Yangilikni tahrirlash / nashr etish' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.update(id, dto, file, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.NEWS_MANAGE)
  @ApiOperation({ summary: 'Yangilikni o‘chirish (idempotent)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.service.remove(id, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
