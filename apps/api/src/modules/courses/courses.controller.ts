import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
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
  @ApiOperation({ summary: 'Kurslar ro‘yxati (STUDENT faqat published)' })
  async list(@Query() query: QueryCourseDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.courses.listCourses(query, actor.roles, actor.id);
  }

  @Get('slug/:slug')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kursni slug bo‘yicha topish (STUDENT faqat published)' })
  async detailBySlug(@Param('slug') slug: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.courses.findCourseBySlug(slug, actor.roles, actor.id);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kurs tafsilotlari (STUDENT faqat published)' })
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.courses.findCourseById(id, actor.roles, actor.id);
  }

  @Get(':id/lessons')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Kursning barcha darslari (tartib bo‘yicha)' })
  async lessons(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.courses.listLessonsByCourse(id, actor.roles, actor.id);
  }

  @Put(':id/lessons/order')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Darslar tartibini bir yo‘la qayta tartiblash' })
  async reorderLessons(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { lessonIds: string[] },
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.reorderLessons(
      id,
      body.lessonIds,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
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

  @Post(':id/clone')
  @RequirePermissions(PERMISSION.COURSES_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kursni nusxalash (LIBRARY yoki o‘z kurs)' })
  async clone(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.cloneCourse(
      id,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }

  @Get(':id/removal-impact')
  @RequirePermissions(PERMISSION.COURSES_DELETE)
  @ApiOperation({ summary: 'Kursni o‘chirish ta‘sir hisoboti' })
  async courseRemovalImpact(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.courses.courseRemovalImpact(id, actor.roles, actor.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.COURSES_UPDATE)
  @ApiOperation({ summary: 'Kursni tahrirlash (TEACHER faqat o‘ziniki)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.updateCourse(
      id,
      dto,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.COURSES_DELETE)
  @ApiOperation({ summary: 'Kursni o‘chirish (TEACHER faqat o‘ziniki)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.removeCourse(
      id,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
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
  async list(@Query() query: QueryLessonDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.courses.listLessons(query, actor.roles, actor.id);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.COURSES_READ)
  @ApiOperation({ summary: 'Dars tafsilotlari (kurs bilan birga)' })
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.courses.findLessonById(id, actor.roles, actor.id);
  }

  @Post()
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kursga yangi dars qo‘shish' })
  async create(
    @Body() dto: CreateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.createLesson(
      dto,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Darsni tahrirlash' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.courses.updateLesson(
      id,
      dto,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Darsni arxivlash (?hard=true bilan to‘liq o‘chirish)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
    @Query('hard') hard?: string,
  ) {
    return this.courses.removeLesson(
      id,
      { actorId: actor.id, ip, userAgent: req.headers['user-agent'] },
      actor.roles,
      hard === 'true',
    );
  }

  @Get(':id/removal-impact')
  @RequirePermissions(PERMISSION.LESSONS_MANAGE)
  @ApiOperation({ summary: 'Darsni o‘chirish ta‘sir hisoboti' })
  async removalImpact(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.courses.lessonRemovalImpact(id, actor.roles, actor.id);
  }
}
