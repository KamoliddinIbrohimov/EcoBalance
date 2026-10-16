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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION } from '@eco/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/authorization/permissions.guard';
import { RequirePermissions } from '../auth/authorization/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
import {
  CreateAssignmentDto,
  GradeAssignmentDto,
  LessonProgressUpdateDto,
  QueryAssignmentDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from './dto/lms.dto';
import { LmsService } from './lms.service';

const asActor = (user: AuthenticatedUser) => ({ id: user.id, roles: user.roles });

@ApiTags('LMS - Assignments')
@ApiBearerAuth('access-token')
@Controller({ path: 'assignments', version: '1' })
@UseGuards(PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly lms: LmsService) {}

  @Get()
  @ApiOperation({ summary: 'Topshiriqlar ro‘yxati (rolga qarab filtr)' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryAssignmentDto) {
    return this.lms.listAssignments(query, asActor(user));
  }

  @Post()
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi topshiriq (TEACHER/SA)' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssignmentDto) {
    return this.lms.createAssignment(dto, asActor(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: 'Topshiriqni tahrirlash' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.lms.updateAssignment(id, dto, asActor(user));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Topshiriqni o‘chirish' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.lms.removeAssignment(id, asActor(user));
  }

  @Post(':id/submissions')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_SUBMIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Talaba o‘z javobini topshiradi (yoki qayta topshiradi)' })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.lms.submitAssignment(id, dto, asActor(user));
  }

  @Post(':id/start')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_SUBMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'F4 TIMED: urinishni boshlash (server-side taymer)' })
  async startTimed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.startTimedAttempt(id, asActor(user));
  }

  @Post(':id/accommodations/:studentId')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'F4: alohida talabaga vaqt uzaytirish' })
  async upsertAccommodation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Body() body: { extraMinutes?: number; newDueAt?: string },
  ) {
    return this.lms.upsertAccommodation(
      id,
      studentId,
      {
        extraMinutes: body?.extraMinutes,
        newDueAt: body?.newDueAt ? new Date(body.newDueAt) : undefined,
      },
      asActor(user),
    );
  }

  @Get(':id/submissions')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: 'Topshiriqning barcha javoblari (TEACHER/SA)' })
  async submissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.listSubmissions(id, asActor(user));
  }

  @Get(':id/my-submission')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_SUBMIT)
  @ApiOperation({ summary: 'O‘z javobim (yoki null)' })
  async mySubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.mySubmission(id, asActor(user));
  }

  @Patch('submissions/:submissionId/grade')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: 'Javobni baholash' })
  async grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Body() dto: GradeAssignmentDto,
  ) {
    return this.lms.gradeSubmission(submissionId, dto, asActor(user));
  }

  @Post('submissions/:submissionId/reopen')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: 'Topshiriqni qayta ochish (RETURNED) — talaba qayta topshira oladi' })
  async reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Body() body: { feedbackUz?: string },
  ) {
    return this.lms.reopenSubmission(submissionId, body?.feedbackUz, asActor(user));
  }

  // -------- File upload (L14) --------

  @Post(':id/attachment')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Topshiriqqa fayl biriktirish (shablon)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.lms.uploadAssignmentAttachment(id, file, asActor(user));
  }

  @Get(':id/attachment-url')
  @ApiOperation({ summary: 'Topshiriq shablon faylini yuklab olish URL (presigned)' })
  async attachmentUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.getAssignmentAttachmentUrl(id, asActor(user));
  }

  @Post(':id/submissions/file')
  @RequirePermissions(PERMISSION.ASSIGNMENTS_SUBMIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Talaba fayl bilan topshiradi' })
  @UseInterceptors(FileInterceptor('file'))
  async submitFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.lms.uploadSubmissionFile(id, file, asActor(user));
  }

  @Get('submissions/:submissionId/file-url')
  @ApiOperation({ summary: 'Topshirilgan faylni yuklab olish URL (presigned)' })
  async submissionFileUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
  ) {
    return this.lms.getSubmissionFileUrl(submissionId, asActor(user));
  }
}

@ApiTags('LMS - Lesson Progress')
@ApiBearerAuth('access-token')
@Controller({ path: 'lessons', version: '1' })
@UseGuards(PermissionsGuard)
export class LessonProgressController {
  constructor(private readonly lms: LmsService) {}

  @Post(':id/progress')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Darsni ko‘rildi/tugatildi deb belgilash' })
  async updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: LessonProgressUpdateDto,
  ) {
    return this.lms.updateProgress(lessonId, dto.completed, asActor(user));
  }

  @Get('progress/me')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'O‘z dars progress ro‘yxatim' })
  async myProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.lms.myProgress(asActor(user));
  }

  @Post(':id/heartbeat')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'F5 (2.C): dars sahifasida qolgan vaqtni jo‘natish (max 60s)' })
  async heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) lessonId: string,
    @Body() body: { activeSeconds: number; position?: number },
  ) {
    return this.lms.heartbeat(lessonId, body.activeSeconds, body.position, asActor(user));
  }
}

@ApiTags('LMS - Statistics')
@ApiBearerAuth('access-token')
@Controller({ path: 'stats', version: '1' })
@UseGuards(PermissionsGuard)
export class StatsController {
  constructor(private readonly lms: LmsService) {}

  @Get('me')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'O‘z statistikam (talaba uchun)' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.lms.myStats(asActor(user));
  }

  @Get('students/:id')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'Talaba statistikasi (o‘qituvchi/SA)' })
  async student(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.studentStats(id, asActor(user));
  }

  @Get('groups/:id')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'Guruh statistikasi (o‘qituvchi/SA)' })
  async group(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.groupStats(id, asActor(user));
  }

  @Get('groups/:id/students')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'Guruh talabalari kesimida statistika jadvali' })
  async groupStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.groupStudents(id, asActor(user));
  }

  @Get('students/:id/overview')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'Talaba to‘liq ko‘rinishi (progress + risk + weekly)' })
  async studentOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lms.studentOverview(id, asActor(user));
  }

  @Get('students/:id/timeline')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: 'Talaba study events timeline (so‘nggi 200)' })
  async studentTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // N16: noto'g'ri sana -> 400
    const parseDate = (raw: string | undefined, label: string): Date | undefined => {
      if (!raw) return undefined;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        throw new (require('@nestjs/common').BadRequestException)(
          `${label}: ISO 8601 formatida sana kiriting`,
        );
      }
      return d;
    };
    return this.lms.studentTimeline(id, asActor(user), parseDate(from, 'from'), parseDate(to, 'to'));
  }

  @Get('me/overview')
  @RequirePermissions(PERMISSION.STATS_READ_OWN)
  @ApiOperation({ summary: "O'z overview — risks, time, weekly activity" })
  async meOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.lms.studentOverview(user.id, asActor(user));
  }
}
