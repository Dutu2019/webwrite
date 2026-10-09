import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertEnrolled, requireRole } from "@/lib/guards";
import { handle, notFound, ok } from "@/lib/http";
import { assignmentDto } from "@/lib/dto";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** Aggregate result for one assignment: best score per question + completion. */
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!assignment || !assignment.published) {
      throw notFound("Assignment not found");
    }
    await assertEnrolled(user.id, assignment.courseId);

    const questionIds = assignment.questions.map((q) => q.id);
    const [submissions, completion] = await Promise.all([
      prisma.submission.findMany({
        where: { studentId: user.id, questionId: { in: questionIds } },
        orderBy: { attemptNumber: "asc" },
      }),
      prisma.completion.findUnique({
        where: {
          assignmentId_studentId: { assignmentId: assignment.id, studentId: user.id },
        },
      }),
    ]);

    const perQuestion = assignment.questions.map((q) => {
      const attempts = submissions.filter((s) => s.questionId === q.id);
      const bestScore = attempts.reduce((max, s) => Math.max(max, s.score ?? 0), 0);
      return {
        questionId: q.id,
        prompt: q.prompt,
        points: q.points,
        attempts: attempts.length,
        bestScore,
        isCorrect: attempts.some((s) => s.isCorrect),
      };
    });

    const maxPoints = assignment.questions.reduce((sum, q) => sum + q.points, 0);
    const earnedPoints =
      Math.round(
        perQuestion.reduce((sum, pq) => {
          const q = assignment.questions.find((x) => x.id === pq.questionId)!;
          return sum + (pq.bestScore / 100) * q.points;
        }, 0) * 100,
      ) / 100;

    return ok({
      assignment: assignmentDto(assignment),
      completed: Boolean(completion),
      completion: completion
        ? {
            completedAt: completion.completedAt,
            score: completion.score,
            attempts: completion.attempts,
          }
        : null,
      perQuestion,
      earnedPoints,
      maxPoints,
    });
  });
}
