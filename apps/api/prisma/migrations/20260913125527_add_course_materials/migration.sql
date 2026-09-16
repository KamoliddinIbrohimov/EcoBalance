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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_materials_storage_key_key" ON "course_materials"("storage_key");

-- CreateIndex
CREATE INDEX "course_materials_course_id_idx" ON "course_materials"("course_id");

-- CreateIndex
CREATE INDEX "course_materials_lesson_id_idx" ON "course_materials"("lesson_id");

-- AddForeignKey
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
