-- AlterTable
ALTER TABLE "Question" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'SHORT_ANSWER',
ADD COLUMN "options" TEXT;

-- CreateTable
CREATE TABLE "AssignmentOpen" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentOpen_studentId_idx" ON "AssignmentOpen"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentOpen_assignmentId_studentId_key" ON "AssignmentOpen"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "AssignmentOpen" ADD CONSTRAINT "AssignmentOpen_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOpen" ADD CONSTRAINT "AssignmentOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
