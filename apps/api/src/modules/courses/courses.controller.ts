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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import {
  CreateLessonDto,
  QueryLessonDto,
  UpdateLessonDto,
} from './dto/create-lesson.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('Courses')
@ApiBearerAuth('access-token')
@Controller({ path: 'courses', version: '1' })
@UseGuards(PermissionsGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  // ---- Courses ----

  @Get()
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kurslar ro‘yxati (sahifalash, qidiruv, nashr filtri)' })
  async list(@Query() query: QueryCourseDto) {
    return this.courses.listCourses(query);
  }

  @Get('slug/:slug')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kursni slug bo‘yicha topish' })
  async detailBySlug(@Param('slug') slug: string) {
    return this.courses.findCourseBySlug(slug);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kurs tafsilotlari' })
  async detail(@Param('id') id: string) {
    return this.courses.findCourseById(id);
  }

  @Get(':id/lessons')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kursning barcha darslari (tartib bo‘yicha)' })
  async lessons(@Param('id') id: string) {
    return this.courses.listLessonsByCourse(id);
  }

  @Post()
  @RequirePermissions(PERMISSION.COURSES_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi kurs yaratish' })
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.createCourse(dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.COURSES_UPDATE)
  @ApiOperation({ summary: 'Kursni tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.updateCourse(id, dto, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.COURSES_DELETE)
  @ApiOperation({ summary: 'Kursni o‘chirish (barcha darslari ham o‘chiriladi)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.removeCourse(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}

@ApiTags('Lessons')
@ApiBearerAuth('access-token')
@Controller({ path: 'lessons', version: '1' })
@UseGuards(PermissionsGuard)
export class LessonsController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Darslar ro‘yxati (kurs / tur bo‘yicha filtr)' })
  async list(@Query() query: QueryLessonDto) {
    return this.courses.listLessons(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Dars tafsilotlari (kurs bilan birga)' })
  async detail(@Param('id') id: string) {
    return this.courses.findLessonById(id);
  }

  @Post()
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kursga yangi dars qo‘shish' })
  async create(
    @Body() dto: CreateLessonDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.createLesson(dto, { actorId, ip, userAgent: req.headers['user-agent'] });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Darsni tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.updateLesson(id, dto, {
      actorId,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Darsni o‘chirish' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.removeLesson(id, { actorId, ip, userAgent: req.headers['user-agent'] });
  }
}
