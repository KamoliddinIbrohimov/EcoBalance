import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type BindQuizSettingsInput,
  type UpsertReleaseInput,
  bindQuizSettingsSchema,
  upsertReleaseSchema,
} from '@eco/shared';

import { ZBody } from '../../common/http/zod.pipe';
import { type Actor, CurrentActor, Roles } from '../auth/actor';
import { BindingsService } from './bindings.service';
import { ReleasesService } from './releases.service';

const Id = (name = 'id') => Param(name, ParseUUIDPipe);

/** Guruh kontenti: biriktirilgan kurslar, testlar va dars ochilishlari. */
@Controller('groups/:id')
@Roles('SUPER_ADMIN', 'TEACHER')
export class GroupContentController {
  constructor(
    private readonly bindings: BindingsService,
    private readonly releases: ReleasesService,
  ) {}

  // ---- Kurslar ----

  @Get('courses')
  courses(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.bindings.courses(id, actor);
  }

  @Post('courses/:courseId')
  bindCourse(@Id() id: string, @Id('courseId') courseId: string, @CurrentActor() actor: Actor) {
    return this.bindings.bindCourse(id, courseId, actor);
  }

  @Delete('courses/:courseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbindCourse(@Id() id: string, @Id('courseId') courseId: string, @CurrentActor() actor: Actor) {
    await this.bindings.unbindCourse(id, courseId, actor);
  }

  // ---- Testlar ----

  @Get('quizzes')
  quizzes(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.bindings.quizzes(id, actor);
  }

  @Post('quizzes/:quizId')
  bindQuiz(
    @Id() id: string,
    @Id('quizId') quizId: string,
    @ZBody(bindQuizSettingsSchema) body: BindQuizSettingsInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.bindings.bindQuiz(id, quizId, body, actor);
  }

  @Patch('quizzes/:quizId')
  updateQuiz(
    @Id() id: string,
    @Id('quizId') quizId: string,
    @ZBody(bindQuizSettingsSchema) body: BindQuizSettingsInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.bindings.updateQuiz(id, quizId, body, actor);
  }

  @Delete('quizzes/:quizId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbindQuiz(@Id() id: string, @Id('quizId') quizId: string, @CurrentActor() actor: Actor) {
    await this.bindings.unbindQuiz(id, quizId, actor);
  }

  // ---- Dars/modul ochilishi ----

  @Get('releases')
  releasesList(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.releases.list(id, actor);
  }

  @Post('releases')
  @HttpCode(HttpStatus.OK)
  upsertRelease(@Id() id: string, @ZBody(upsertReleaseSchema) body: UpsertReleaseInput, @CurrentActor() actor: Actor) {
    return this.releases.upsert(id, body, actor);
  }

  @Delete('releases/:releaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRelease(@Id() id: string, @Id('releaseId') releaseId: string, @CurrentActor() actor: Actor) {
    await this.releases.remove(id, releaseId, actor);
  }
}
