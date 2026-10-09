import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { assignmentDto } from "@/lib/dto";

/**
 * Published assignments across the student's active enrollments, with
 * completion status. Students never see unpublished work or other courses.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.id, status: "ACTIVE" },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    const assignments = await prisma.assignment.findMany({
      where: { courseId: { in: courseIds }, published: true },
      include: {
        course: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
        completions: { where: { studentId: user.id } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });

    return ok({
      assignments: assignments.map((a) => {
        const completion = a.completions[0];
        return {
          ...assignmentDto(a),
          course: a.course,
          questionCount: a._count.questions,
          completed: Boolean(completion),
          completion: completion
            ? {
                completedAt: completion.completedAt,
                score: completion.score,
                attempts: completion.attempts,
              }
            : null,
        };
      }),
    });
  });
}
