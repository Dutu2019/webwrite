import type { NextRequest } from "next/server";
import type { Submission } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { forbidden, handle, notFound, ok } from "@/lib/http";
import { assignmentDto, publicUser, teacherQuestionDto, teacherSubmissionDto } from "@/lib/dto";
import { assignmentProgress } from "@/lib/scoring";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Per-student results for one assignment (teacher, owner only): whether each
 * student opened it, their attempts and best score, and every submission.
 * Questions come with the answer key so the teacher can read answers against it.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireRole(req, "TEACHER");

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { course: true, questions: { orderBy: { order: "asc" } } },
    });
    if (!assignment) throw notFound("Assignment not found");
    if (assignment.course.teacherId !== user.id) {
      throw forbidden("You do not own this assignment");
    }

    const questionIds = assignment.questions.map((q) => q.id);

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: assignment.courseId, status: "ACTIVE" },
      include: { student: true },
      orderBy: { createdAt: "asc" },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const [submissions, completions, opens] = await Promise.all([
      prisma.submission.findMany({
        where: { questionId: { in: questionIds }, studentId: { in: studentIds } },
        orderBy: { attemptNumber: "asc" },
      }),
      prisma.completion.findMany({ where: { assignmentId: assignment.id } }),
      prisma.assignmentOpen.findMany({ where: { assignmentId: assignment.id }, select: { studentId: true } }),
    ]);
    const openedBy = new Set(opens.map((o) => o.studentId));

    const byStudent = new Map<string, Submission[]>();
    for (const s of submissions) {
      const list = byStudent.get(s.studentId) ?? [];
      list.push(s);
      byStudent.set(s.studentId, list);
    }
    const completionByStudent = new Map(completions.map((c) => [c.studentId, c]));

    return ok({
      assignment: assignmentDto(assignment),
      questions: assignment.questions.map(teacherQuestionDto),
      students: enrollments.map((e) => {
        const completion = completionByStudent.get(e.studentId);
        const mine = byStudent.get(e.studentId) ?? [];
        const progress = assignmentProgress(
          assignment.questions.map((q) => ({
            points: q.points,
            submissions: mine.filter((s) => s.questionId === q.id),
          })),
        );
        return {
          student: publicUser(e.student),
          opened: openedBy.has(e.studentId) || mine.length > 0,
          ...progress,
          completion: completion
            ? {
                completedAt: completion.completedAt,
                score: completion.score,
                attempts: completion.attempts,
              }
            : null,
          submissions: mine.map(teacherSubmissionDto),
        };
      }),
    });
  });
}
