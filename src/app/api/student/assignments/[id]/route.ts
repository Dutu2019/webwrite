import type { NextRequest } from "next/server";
import type { Submission } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertEnrolled, requireRole } from "@/lib/guards";
import { handle, notFound, ok } from "@/lib/http";
import { assignmentDto, studentQuestionDto, studentSubmissionDto } from "@/lib/dto";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Assignment detail for a student. Questions are stripped of `reference` and
 * `criteria`, and the student's own attempts are attached per question.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: true,
        questions: { orderBy: { order: "asc" } },
      },
    });
    if (!assignment || !assignment.published) {
      throw notFound("Assignment not found");
    }
    await assertEnrolled(user.id, assignment.courseId);

    const questionIds = assignment.questions.map((q) => q.id);
    const submissions = await prisma.submission.findMany({
      where: { studentId: user.id, questionId: { in: questionIds } },
      orderBy: { attemptNumber: "desc" },
    });

    const byQuestion = new Map<string, Submission[]>();
    for (const s of submissions) {
      const list = byQuestion.get(s.questionId) ?? [];
      list.push(s);
      byQuestion.set(s.questionId, list);
    }

    return ok({
      assignment: assignmentDto(assignment),
      course: { id: assignment.course.id, name: assignment.course.name },
      questions: assignment.questions.map((q) => ({
        ...studentQuestionDto(q),
        attempts: (byQuestion.get(q.id) ?? []).map(studentSubmissionDto),
      })),
    });
  });
}
