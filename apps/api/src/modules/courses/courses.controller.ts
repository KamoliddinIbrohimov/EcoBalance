import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  type CourseQuery,
  type CreateCourseInput,
  type CreateLessonInput,
  type UpdateCourseInput,
  type UpdateLessonInput,
  courseQuerySchema,
  createCourseSchema,
  createLessonSchema,
  updateCourseSchema,
  updateLessonSchema,
} from '@eco/shared';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { CoursesService } from './courses.service';
import { LessonsService } from './lessons.service';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly lessons: LessonsService,
  ) {}

  @Get()
  list(@ZQuery(courseQuerySchema) q: CourseQuery, @CurrentActor() actor: Actor) {
    return this.courses.list(q, actor);
  }

  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string, @CurrentActor() actor: Actor) {
    return this.courses.bySlug(slug, actor);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.courses.byId(id, actor);
  }

  @Get(':id/lessons')
  courseLessons(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.lessons.listByCourse(id, actor);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TEACHER')
  create(@ZBody(createCourseSchema) body: CreateCourseInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.courses.create(body, actor, client);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateCourseSchema) body: UpdateCourseInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.courses.update(id, body, actor, client);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.courses.remove(id, actor, client);
  }
}

/**
 * Faqat `/lessons/:id` (bitta segment). Progress yo'llari
 * (`/lessons/progress/me`, `/lessons/:id/progress|heartbeat`) learning modulida.
 */
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.lessons.byId(id, actor);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TEACHER')
  create(@ZBody(createLessonSchema) body: CreateLessonInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.lessons.create(body, actor, client);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateLessonSchema) body: UpdateLessonInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.lessons.update(id, body, actor, client);
  }

  /** Standart — arxivlash; `?hard=true` — butunlay o'chirish. */
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hard: string | undefined,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.lessons.remove(id, hard === 'true', actor, client);
  }
}
