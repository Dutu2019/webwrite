-- Same objects as 20261010000001_question_types_and_opens: two fixes for the
-- broken SQLite migrations landed at once. Kept (rather than deleted) so databases
-- that already recorded it stay consistent; made idempotent so a fresh database,
-- where 20261010000001 has already created everything, no longer fails here with
-- "column already exists".

-- AlterTable
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'SHORT_ANSWER';
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "options" TEXT;

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
