-- Question types, multiple-choice options, and assignment opens, for PostgreSQL.
-- Replaces three SQLite-only migrations that sorted before 20261010000000_init and
-- broke `prisma migrate deploy` on a fresh database. Every statement is idempotent,
-- so this is also safe on a database where these objects already exist
-- (e.g. one that was set up with `prisma db push`).

-- AlterTable
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "options" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'SHORT_ANSWER';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssignmentOpen" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssignmentOpen_studentId_idx" ON "AssignmentOpen"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AssignmentOpen_assignmentId_studentId_key" ON "AssignmentOpen"("assignmentId", "studentId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AssignmentOpen" ADD CONSTRAINT "AssignmentOpen_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AssignmentOpen" ADD CONSTRAINT "AssignmentOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
