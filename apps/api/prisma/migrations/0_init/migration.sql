-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleSlug" AS ENUM ('SUPER_ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'RETURNED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('TASK', 'TIMED', 'QUESTIONNAIRE');

-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('PRIVATE', 'LIBRARY');

-- CreateEnum
CREATE TYPE "GroupLessonReleaseStatus" AS ENUM ('LOCKED', 'SCHEDULED', 'OPEN');

-- CreateEnum
CREATE TYPE "StudyEventType" AS ENUM ('LESSON_OPEN', 'LESSON_HEARTBEAT', 'LESSON_COMPLETE', 'MATERIAL_OPEN', 'QUIZ_START', 'QUIZ_SUBMIT', 'ASSIGNMENT_OPEN', 'ASSIGNMENT_SUBMIT');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('CITY', 'DISTRICT', 'MAHALLA', 'SCHOOL', 'KINDERGARTEN', 'UNIVERSITY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'TOKEN_REFRESH', 'TOKEN_REVOKED');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('MARUZA', 'AMALIY', 'LABORATORIYA', 'EKSKURSIYA');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('MAKTABGACHA', 'MAKTAB', 'OLIY_TALIM', 'RESERVED');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "EcoReportCategory" AS ENUM ('WASTE', 'WATER', 'GREEN_AREA', 'AIR_NOISE', 'ENERGY', 'OTHER');

-- CreateEnum
CREATE TYPE "EcoReportRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EcoReportStatus" AS ENUM ('REPORTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'LIKERT_5');

-- CreateEnum
CREATE TYPE "QuizSubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32),
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT,
    "locale" VARCHAR(8) NOT NULL DEFAULT 'uz',
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(45),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" UUID,
    "created_by_id" UUID,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "slug" "RoleSlug" NOT NULL,
    "name_uz" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "module" VARCHAR(60) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "name_uz" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "type" "OrganizationType" NOT NULL,
    "name_uz" VARCHAR(255) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "address" JSONB,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "subject_type" VARCHAR(120),
    "subject_id" UUID,
    "changes" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "title_uz" VARCHAR(255) NOT NULL,
    "body_uz" TEXT NOT NULL,
    "attachment_key" VARCHAR(500),
    "attachment_file_name" VARCHAR(255),
    "attachment_mime_type" VARCHAR(120),
    "attachment_size_bytes" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "author_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "title_uz" VARCHAR(255) NOT NULL,
    "body_uz" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "family_id" UUID NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name_uz" VARCHAR(255) NOT NULL,
    "description_uz" TEXT,
    "education_level" VARCHAR(60) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" UUID,
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_level_items" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name_uz" VARCHAR(120) NOT NULL,
    "description_uz" VARCHAR(500),
    "icon_name" VARCHAR(60) NOT NULL DEFAULT 'GraduationCap',
    "order_index" SMALLINT NOT NULL DEFAULT 0,
    "linked_enum" "EducationLevel",
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_level_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "module_id" UUID,
    "order_index" SMALLINT NOT NULL,
    "lesson_type" "LessonType" NOT NULL,
    "title_uz" VARCHAR(255) NOT NULL,
    "objective_uz" TEXT,
    "equipment_uz" TEXT,
    "theory_uz" TEXT,
    "procedure_uz" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "estimated_minutes" SMALLINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "order_index" SMALLINT NOT NULL,
    "title_uz" VARCHAR(255) NOT NULL,
    "description_uz" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_lesson_releases" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "lesson_id" UUID,
    "module_id" UUID,
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "status" "GroupLessonReleaseStatus" NOT NULL DEFAULT 'LOCKED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_lesson_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_materials" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "lesson_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" UUID,
    "content_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "reported_by" UUID NOT NULL,
    "category" "EcoReportCategory" NOT NULL,
    "risk_level" "EcoReportRisk" NOT NULL,
    "status" "EcoReportStatus" NOT NULL DEFAULT 'REPORTED',
    "description_uz" TEXT NOT NULL,
    "suggestion_uz" TEXT,
    "ai_note_uz" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location_label" VARCHAR(255),
    "photo_before_key" VARCHAR(512),
    "photo_after_key" VARCHAR(512),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eco_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "lesson_id" UUID,
    "title_uz" VARCHAR(255) NOT NULL,
    "description_uz" TEXT,
    "pass_percent" SMALLINT NOT NULL DEFAULT 60,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" UUID,
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "time_limit_minutes" SMALLINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "order_index" SMALLINT NOT NULL,
    "type" "QuizQuestionType" NOT NULL,
    "text_uz" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_submissions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "QuizSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score_total" SMALLINT,
    "score_max" SMALLINT,
    "score_percent" SMALLINT,
    "passed" BOOLEAN,
    "likert_sum" SMALLINT,
    "likert_max" SMALLINT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "quiz_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name_uz" VARCHAR(255) NOT NULL,
    "description_uz" TEXT,
    "teacher_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","student_id")
);

-- CreateTable
CREATE TABLE "course_groups" (
    "course_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "sequential" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_groups_pkey" PRIMARY KEY ("course_id","group_id")
);

-- CreateTable
CREATE TABLE "group_quizzes" (
    "quiz_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "max_attempts" SMALLINT,
    "time_limit_minutes" SMALLINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_quizzes_pkey" PRIMARY KEY ("quiz_id","group_id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_viewed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "time_spent_sec" INTEGER NOT NULL DEFAULT 0,
    "last_position" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "lesson_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "active_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_events" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "type" "StudyEventType" NOT NULL,
    "ref_id" UUID,
    "meta" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "course_id" UUID,
    "lesson_id" UUID,
    "module_id" UUID,
    "group_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "kind" "AssignmentKind" NOT NULL DEFAULT 'TASK',
    "title_uz" VARCHAR(255) NOT NULL,
    "description_uz" TEXT,
    "due_at" TIMESTAMP(3),
    "max_score" SMALLINT NOT NULL DEFAULT 100,
    "attachment_key" VARCHAR(512),
    "attachment_file_name" VARCHAR(255),
    "allow_late" BOOLEAN NOT NULL DEFAULT false,
    "late_penalty_percent" SMALLINT NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "time_limit_minutes" SMALLINT,
    "quiz_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_accommodations" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "extra_minutes" SMALLINT,
    "new_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_accommodations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "text_uz" TEXT,
    "file_key" VARCHAR(512),
    "file_name" VARCHAR(255),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "feedback_uz" TEXT,
    "graded_by_id" UUID,
    "graded_at" TIMESTAMP(3),
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "attempt" SMALLINT NOT NULL DEFAULT 1,
    "attempt_started_at" TIMESTAMP(3),
    "attempt_deadline" TIMESTAMP(3),
    "is_late" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submission_revisions" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "attempt" SMALLINT NOT NULL,
    "text_uz" TEXT,
    "file_key" VARCHAR(512),
    "file_name" VARCHAR(255),
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "score" INTEGER,
    "feedback_uz" TEXT,
    "graded_by_id" UUID,
    "graded_at" TIMESTAMP(3),
    "status" "AssignmentSubmissionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submission_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "organizations_parent_id_idx" ON "organizations"("parent_id");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_subject_type_subject_id_idx" ON "audit_logs"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "news_is_published_published_at_idx" ON "news"("is_published", "published_at" DESC);

-- CreateIndex
CREATE INDEX "news_created_at_idx" ON "news"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_is_published_idx" ON "courses"("is_published");

-- CreateIndex
CREATE INDEX "courses_education_level_idx" ON "courses"("education_level");

-- CreateIndex
CREATE INDEX "courses_owner_id_idx" ON "courses"("owner_id");

-- CreateIndex
CREATE INDEX "courses_visibility_idx" ON "courses"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "education_level_items_slug_key" ON "education_level_items"("slug");

-- CreateIndex
CREATE INDEX "education_level_items_order_index_idx" ON "education_level_items"("order_index");

-- CreateIndex
CREATE INDEX "lessons_course_id_idx" ON "lessons"("course_id");

-- CreateIndex
CREATE INDEX "lessons_lesson_type_idx" ON "lessons"("lesson_type");

-- CreateIndex
CREATE INDEX "lessons_module_id_idx" ON "lessons"("module_id");

-- CreateIndex
CREATE INDEX "lessons_archived_at_idx" ON "lessons"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_course_order_unique" ON "lessons"("course_id", "order_index");

-- CreateIndex
CREATE INDEX "modules_course_id_idx" ON "modules"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_course_order_unique" ON "modules"("course_id", "order_index");

-- CreateIndex
CREATE INDEX "group_lesson_releases_group_id_idx" ON "group_lesson_releases"("group_id");

-- CreateIndex
CREATE INDEX "group_lesson_releases_lesson_id_idx" ON "group_lesson_releases"("lesson_id");

-- CreateIndex
CREATE INDEX "group_lesson_releases_module_id_idx" ON "group_lesson_releases"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_release_unique" ON "group_lesson_releases"("group_id", "lesson_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_materials_storage_key_key" ON "course_materials"("storage_key");

-- CreateIndex
CREATE INDEX "course_materials_course_id_idx" ON "course_materials"("course_id");

-- CreateIndex
CREATE INDEX "course_materials_lesson_id_idx" ON "course_materials"("lesson_id");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_updated_at_idx" ON "ai_conversations"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "eco_reports_category_idx" ON "eco_reports"("category");

-- CreateIndex
CREATE INDEX "eco_reports_status_idx" ON "eco_reports"("status");

-- CreateIndex
CREATE INDEX "eco_reports_organization_id_idx" ON "eco_reports"("organization_id");

-- CreateIndex
CREATE INDEX "eco_reports_created_at_idx" ON "eco_reports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "quizzes_lesson_id_idx" ON "quizzes"("lesson_id");

-- CreateIndex
CREATE INDEX "quizzes_is_published_idx" ON "quizzes"("is_published");

-- CreateIndex
CREATE INDEX "quizzes_visibility_idx" ON "quizzes"("visibility");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions"("quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quiz_order_unique" ON "quiz_questions"("quiz_id", "order_index");

-- CreateIndex
CREATE INDEX "quiz_submissions_quiz_id_user_id_idx" ON "quiz_submissions"("quiz_id", "user_id");

-- CreateIndex
CREATE INDEX "quiz_submissions_user_id_idx" ON "quiz_submissions"("user_id");

-- CreateIndex
CREATE INDEX "quiz_submissions_submitted_at_idx" ON "quiz_submissions"("submitted_at" DESC);

-- CreateIndex
CREATE INDEX "quiz_answers_question_id_idx" ON "quiz_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answers_submission_question_unique" ON "quiz_answers"("submission_id", "question_id");

-- CreateIndex
CREATE INDEX "groups_teacher_id_idx" ON "groups"("teacher_id");

-- CreateIndex
CREATE INDEX "groups_is_active_idx" ON "groups"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_student_id_key" ON "group_members"("student_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "course_groups_group_id_idx" ON "course_groups"("group_id");

-- CreateIndex
CREATE INDEX "group_quizzes_group_id_idx" ON "group_quizzes"("group_id");

-- CreateIndex
CREATE INDEX "lesson_progress_student_id_idx" ON "lesson_progress"("student_id");

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_student_lesson_unique" ON "lesson_progress"("student_id", "lesson_id");

-- CreateIndex
CREATE INDEX "study_sessions_student_id_idx" ON "study_sessions"("student_id");

-- CreateIndex
CREATE INDEX "study_sessions_lesson_id_idx" ON "study_sessions"("lesson_id");

-- CreateIndex
CREATE INDEX "study_sessions_started_at_idx" ON "study_sessions"("started_at" DESC);

-- CreateIndex
CREATE INDEX "study_events_student_id_at_idx" ON "study_events"("student_id", "at" DESC);

-- CreateIndex
CREATE INDEX "study_events_type_idx" ON "study_events"("type");

-- CreateIndex
CREATE INDEX "assignments_group_id_idx" ON "assignments"("group_id");

-- CreateIndex
CREATE INDEX "assignments_created_by_id_idx" ON "assignments"("created_by_id");

-- CreateIndex
CREATE INDEX "assignments_course_id_idx" ON "assignments"("course_id");

-- CreateIndex
CREATE INDEX "assignments_module_id_idx" ON "assignments"("module_id");

-- CreateIndex
CREATE INDEX "assignments_due_at_idx" ON "assignments"("due_at");

-- CreateIndex
CREATE INDEX "assignments_kind_idx" ON "assignments"("kind");

-- CreateIndex
CREATE INDEX "assignment_accommodations_student_id_idx" ON "assignment_accommodations"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_assignment_student_unique" ON "assignment_accommodations"("assignment_id", "student_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_student_id_idx" ON "assignment_submissions"("student_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_status_idx" ON "assignment_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignment_student_unique" ON "assignment_submissions"("assignment_id", "student_id");

-- CreateIndex
CREATE INDEX "assignment_submission_revisions_submission_id_idx" ON "assignment_submission_revisions"("submission_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_lesson_releases" ADD CONSTRAINT "group_lesson_releases_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_lesson_releases" ADD CONSTRAINT "group_lesson_releases_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_lesson_releases" ADD CONSTRAINT "group_lesson_releases_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_reports" ADD CONSTRAINT "eco_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_reports" ADD CONSTRAINT "eco_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "quiz_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_quizzes" ADD CONSTRAINT "group_quizzes_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_quizzes" ADD CONSTRAINT "group_quizzes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_accommodations" ADD CONSTRAINT "assignment_accommodations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_accommodations" ADD CONSTRAINT "assignment_accommodations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submission_revisions" ADD CONSTRAINT "assignment_submission_revisions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Super Admin singleton: tizimda faqat bitta SUPER_ADMIN.
CREATE OR REPLACE FUNCTION enforce_super_admin_singleton()
RETURNS TRIGGER AS $$
DECLARE
  super_role_id UUID;
  other_count INT;
BEGIN
  SELECT id INTO super_role_id FROM roles WHERE slug = 'SUPER_ADMIN';
  IF NEW.role_id = super_role_id THEN
    SELECT COUNT(*) INTO other_count FROM user_roles
      WHERE role_id = super_role_id AND user_id != NEW.user_id;
    IF other_count > 0 THEN
      RAISE EXCEPTION 'Only one SUPER_ADMIN is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_roles_super_admin_singleton_trigger ON user_roles;
CREATE TRIGGER user_roles_super_admin_singleton_trigger
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION enforce_super_admin_singleton();
