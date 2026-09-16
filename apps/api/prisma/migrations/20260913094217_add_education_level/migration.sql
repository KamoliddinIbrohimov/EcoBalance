-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('MAKTABGACHA', 'MAKTAB', 'OLIY_TALIM', 'RESERVED');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "education_level" "EducationLevel" NOT NULL DEFAULT 'OLIY_TALIM';

-- CreateIndex
CREATE INDEX "courses_education_level_idx" ON "courses"("education_level");
