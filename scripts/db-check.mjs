// Read-only connectivity check through the application's Prisma client.
// Usage: npm run db:check
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [users, courses, assignments, questions] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.assignment.count(),
    prisma.question.count(),
  ]);
  console.log(
    `Connected. users=${users} courses=${courses} assignments=${assignments} questions=${questions}`,
  );
} catch (error) {
  console.error("Database check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
