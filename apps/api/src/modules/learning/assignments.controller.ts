import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type AssignmentQuery,
  type CreateAssignmentInput,
  type GradeAssignmentInput,
  type ReopenSubmissionInput,
  type SubmitAssignmentInput,
  type UpdateAssignmentInput,
  assignmentQuerySchema,
  createAssignmentSchema,
  gradeAssignmentSchema,
  reopenSubmissionSchema,
  submitAssignmentSchema,
  updateAssignmentSchema,
} from '@eco/shared';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, Client, type ClientInfo, CurrentActor, Roles } from '../auth/actor';
import { AssignmentsService } from './assignments.service';
import { type AccommodationInput, GradingService, accommodationSchema } from './grading.service';
import { SubmissionsService } from './submissions.service';
import { UPLOAD_OPTIONS } from './upload-policy';

const Uuid = ParseUUIDPipe;

@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly submissions: SubmissionsService,
    private readonly grading: GradingService,
  ) {}

  /** Rolga qarab: SA — hammasi, o'qituvchi — o'zinikilar, talaba — o'z guruhi. */
  @Get()
  list(@ZQuery(assignmentQuerySchema) q: AssignmentQuery, @CurrentActor() actor: Actor) {
    return this.assignments.list(q, actor);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TEACHER')
  create(@ZBody(createAssignmentSchema) body: CreateAssignmentInput, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.assignments.create(body, actor, client);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  update(
    @Param('id', Uuid) id: string,
    @ZBody(updateAssignmentSchema) body: UpdateAssignmentInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.assignments.update(id, body, actor, client);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'TEACHER')
  @HttpCode(204)
  async remove(@Param('id', Uuid) id: string, @CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    await this.assignments.remove(id, actor, client);
  }

  @Post(':id/attachment')
  @Roles('SUPER_ADMIN', 'TEACHER')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  uploadAttachment(
    @Param('id', Uuid) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.assignments.uploadAttachment(id, file, actor, client);
  }

  @Get(':id/attachment-url')
  attachmentUrl(@Param('id', Uuid) id: string, @CurrentActor() actor: Actor) {
    return this.assignments.attachmentUrl(id, actor);
  }

  // ---- talaba ----

  @Post(':id/submissions')
  @Roles('STUDENT')
  submit(@Param('id', Uuid) id: string, @ZBody(submitAssignmentSchema) body: SubmitAssignmentInput, @CurrentActor() actor: Actor) {
    return this.submissions.submitText(id, body, actor);
  }

  @Post(':id/submissions/file')
  @Roles('STUDENT')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  submitFile(@Param('id', Uuid) id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentActor() actor: Actor) {
    return this.submissions.submitFile(id, file, actor);
  }

  @Post(':id/start')
  @Roles('STUDENT')
  @HttpCode(200)
  start(@Param('id', Uuid) id: string, @CurrentActor() actor: Actor) {
    return this.submissions.start(id, actor);
  }

  /** Javob bo'lmasa `{data: null}`. */
  @Get(':id/my-submission')
  mySubmission(@Param('id', Uuid) id: string, @CurrentActor() actor: Actor) {
    return this.submissions.mine(id, actor);
  }

  @Get('submissions/:submissionId/file-url')
  submissionFileUrl(@Param('submissionId', Uuid) id: string, @CurrentActor() actor: Actor) {
    return this.submissions.fileUrl(id, actor);
  }

  // ---- o'qituvchi ----

  @Get(':id/submissions')
  @Roles('SUPER_ADMIN', 'TEACHER')
  listSubmissions(@Param('id', Uuid) id: string, @CurrentActor() actor: Actor) {
    return this.grading.list(id, actor);
  }

  @Patch('submissions/:submissionId/grade')
  @Roles('SUPER_ADMIN', 'TEACHER')
  grade(
    @Param('submissionId', Uuid) id: string,
    @ZBody(gradeAssignmentSchema) body: GradeAssignmentInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.grading.grade(id, body, actor, client);
  }

  @Post('submissions/:submissionId/reopen')
  @Roles('SUPER_ADMIN', 'TEACHER')
  reopen(
    @Param('submissionId', Uuid) id: string,
    @ZBody(reopenSubmissionSchema) body: ReopenSubmissionInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.grading.reopen(id, body.feedbackUz, actor, client);
  }

  @Post(':id/accommodations/:studentId')
  @Roles('SUPER_ADMIN', 'TEACHER')
  @HttpCode(200)
  accommodate(
    @Param('id', Uuid) id: string,
    @Param('studentId', Uuid) studentId: string,
    @ZBody(accommodationSchema) body: AccommodationInput,
    @CurrentActor() actor: Actor,
    @Client() client: ClientInfo,
  ) {
    return this.grading.accommodate(id, studentId, body, actor, client);
  }
}
