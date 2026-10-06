import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import { CreateQuestionDto, ReorderQuestionsDto, UpdateQuestionDto } from './dto/question.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { QueryQuizDto, QuerySubmissionDto } from './dto/query-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QuizzesService } from './quizzes.service';

/**
 * Admin endpointlari — `QUIZZES_MANAGE` kerak. Testlarni yaratish/tahrir va
 * barcha foydalanuvchilarning topshiriqlarini ko'rish uchun.
 */
@ApiTags('Quizzes (admin)')
@ApiBearerAuth('access-token')
@Controller({ path: 'quizzes', version: '1' })
@UseGuards(PermissionsGuard)
export class QuizzesAdminController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @ApiOperation({ summary: 'Testlar ro‘yxati (sahifalash, filtr: lessonId/isPublished)' })
  async list(@Query() query: QueryQuizDto) {
    return this.quizzes.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @ApiOperation({ summary: 'Testning to‘liq tahrirlanishi (savollar + to‘g‘ri javoblar bilan)' })
  async detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.quizzes.getAdminDetail(id);
  }

  @Post()
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Darsga yangi test qo‘shish' })
  async create(@Body() dto: CreateQuizDto) {
    return this.quizzes.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @ApiOperation({ summary: 'Test meta ma‘lumotini tahrirlash (sarlavha/foiz/publish)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Testni o‘chirish (savollar va topshiriqlar bilan)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.quizzes.remove(id);
  }

  // -------- Questions --------

  @Post(':id/questions')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Testga savol qo‘shish' })
  async addQuestion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.quizzes.addQuestion(id, dto);
  }

  @Patch(':id/questions/reorder')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @ApiOperation({ summary: 'Savollar tartibini qayta tartiblash' })
  async reorderQuestions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    await this.quizzes.reorderQuestions(id, dto);
    return { ok: true };
  }

  @Patch('questions/:questionId')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @ApiOperation({ summary: 'Savolni tahrirlash' })
  async updateQuestion(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.quizzes.updateQuestion(questionId, dto);
  }

  @Delete('questions/:questionId')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Savolni o‘chirish' })
  async removeQuestion(@Param('questionId', new ParseUUIDPipe()) questionId: string) {
    await this.quizzes.removeQuestion(questionId);
  }

  // -------- Submissions (admin view) --------

  @Get(':id/submissions')
  @RequirePermissions(PERMISSION.QUIZZES_MANAGE)
  @ApiOperation({ summary: 'Shu testga tegishli barcha topshiriqlar (admin)' })
  async submissionsAdmin(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QuerySubmissionDto,
  ) {
    return this.quizzes.listSubmissionsAdmin(id, query);
  }
}

/**
 * Foydalanuvchi endpointlari — `QUIZZES_TAKE` kerak. Dars tagidagi published
 * testlarni ko'rish/yechish uchun. Bu alohida controller — chunki bazoviy
 * yo'l `my-quizzes`, admin controllerida esa `/quizzes` saqlanadi.
 */
@ApiTags('Quizzes (user)')
@ApiBearerAuth('access-token')
@Controller({ path: 'my-quizzes', version: '1' })
@UseGuards(PermissionsGuard)
export class QuizzesUserController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get('by-lesson/:lessonId')
  @RequirePermissions(PERMISSION.QUIZZES_TAKE)
  @ApiOperation({ summary: 'Dars tagidagi nashr etilgan testlar ro‘yxati' })
  async listForLesson(@Param('lessonId', new ParseUUIDPipe()) lessonId: string) {
    return this.quizzes.listForLessonPublic(lessonId);
  }

  @Get('ekologik')
  @RequirePermissions(PERMISSION.QUIZZES_TAKE)
  @ApiOperation({ summary: 'Ekologik monitoring bo‘limidagi barcha nashr etilgan testlar' })
  async listMonitoringTests() {
    return this.quizzes.listPublishedStandalone();
  }

  @Get(':id/take')
  @RequirePermissions(PERMISSION.QUIZZES_TAKE)
  @ApiOperation({ summary: 'Testni yechish uchun savollarni olish (to‘g‘ri javoblarsiz)' })
  async takeDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.quizzes.getPublicDetail(id);
  }

  @Post(':id/submissions')
  @RequirePermissions(PERMISSION.QUIZZES_TAKE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Testni topshirish — baholanadi va super adminga xabar yuboriladi' })
  async submit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizzes.submit(id, userId, dto);
  }

  @Get(':id/my-submissions')
  @RequirePermissions(PERMISSION.QUIZZES_TAKE)
  @ApiOperation({ summary: 'O‘z topshirishlarim shu test bo‘yicha' })
  async myHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.quizzes.listMySubmissions(id, userId);
  }

  @Get('submissions/:submissionId')
  @RequirePermissions(PERMISSION.QUIZZES_TAKE)
  @ApiOperation({ summary: 'Bitta topshiriq (javoblar bilan) — faqat egasi ko‘ra oladi' })
  async submissionDetail(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.quizzes.getSubmissionForUser(submissionId, userId);
  }
}
