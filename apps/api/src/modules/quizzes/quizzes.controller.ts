import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type CreateQuestionInput,
  type CreateQuizInput,
  type QuizQuery,
  type ReorderQuestionsInput,
  type SubmissionQuery,
  type SubmitQuizInput,
  type UpdateQuestionInput,
  type UpdateQuizInput,
  createQuestionSchema,
  createQuizSchema,
  quizQuerySchema,
  reorderQuestionsSchema,
  submissionQuerySchema,
  submitQuizSchema,
  updateQuestionSchema,
  updateQuizSchema,
} from '@eco/shared';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { AttemptsService } from './attempts.service';
import { QuestionsService } from './questions.service';
import { QuizzesService } from './quizzes.service';

const Id = (name = 'id') => Param(name, ParseUUIDPipe);

/** O'qituvchi/SA: testlar va savollarni boshqarish. Literal yo'llar `:id` dan oldin. */
@Controller('quizzes')
@Roles('SUPER_ADMIN', 'TEACHER')
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly questions: QuestionsService,
  ) {}

  @Patch('questions/:questionId')
  updateQuestion(
    @Id('questionId') questionId: string,
    @ZBody(updateQuestionSchema) body: UpdateQuestionInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.questions.update(questionId, body, actor);
  }

  @Delete('questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeQuestion(@Id('questionId') questionId: string, @CurrentActor() actor: Actor) {
    await this.questions.remove(questionId, actor);
  }

  @Get()
  list(@ZQuery(quizQuerySchema) q: QuizQuery, @CurrentActor() actor: Actor) {
    return this.quizzes.list(q, actor);
  }

  @Get(':id')
  detail(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.quizzes.detail(id, actor);
  }

  @Post()
  create(@ZBody(createQuizSchema) body: CreateQuizInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.quizzes.create(body, actor, client);
  }

  @Patch(':id')
  update(
    @Id() id: string,
    @ZBody(updateQuizSchema) body: UpdateQuizInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.quizzes.update(id, body, actor, client);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Id() id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    await this.quizzes.remove(id, actor, client);
  }

  @Post(':id/questions')
  addQuestion(@Id() id: string, @ZBody(createQuestionSchema) body: CreateQuestionInput, @CurrentActor() actor: Actor) {
    return this.questions.add(id, body, actor);
  }

  @Patch(':id/questions/reorder')
  reorder(@Id() id: string, @ZBody(reorderQuestionsSchema) body: ReorderQuestionsInput, @CurrentActor() actor: Actor) {
    return this.questions.reorder(id, body, actor);
  }

  @Get(':id/submissions')
  submissions(@Id() id: string, @ZQuery(submissionQuerySchema) q: SubmissionQuery, @CurrentActor() actor: Actor) {
    return this.quizzes.submissions(id, q, actor);
  }
}

/**
 * Test yechish. Rol cheklovi yo'q — kirish talabaning guruhi orqali
 * tekshiriladi (o'qituvchi dars sahifasida ham shu yo'lni chaqiradi).
 */
@Controller('my-quizzes')
export class MyQuizzesController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('by-lesson/:lessonId')
  byLesson(@Id('lessonId') lessonId: string, @CurrentActor() actor: Actor) {
    return this.attempts.byLesson(lessonId, actor);
  }

  @Get('ekologik')
  standalone(@CurrentActor() actor: Actor) {
    return this.attempts.standalone(actor);
  }

  @Get('submissions/:submissionId')
  submission(@Id('submissionId') submissionId: string, @CurrentActor() actor: Actor) {
    return this.attempts.submission(submissionId, actor);
  }

  @Get(':id/take')
  take(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.attempts.take(id, actor);
  }

  @Post(':id/submissions')
  submit(@Id() id: string, @ZBody(submitQuizSchema) body: SubmitQuizInput, @CurrentActor() actor: Actor) {
    return this.attempts.submit(id, body, actor);
  }

  @Get(':id/my-submissions')
  mySubmissions(@Id() id: string, @CurrentActor() actor: Actor) {
    return this.attempts.mySubmissions(id, actor);
  }
}
