-- CreateTable
CREATE TABLE "AssignmentOpen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssignmentOpen_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignmentOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssignmentOpen_studentId_idx" ON "AssignmentOpen"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentOpen_assignmentId_studentId_key" ON "AssignmentOpen"("assignmentId", "studentId");
