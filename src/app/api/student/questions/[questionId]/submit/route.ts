import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { studentSubmissionDto } from "@/lib/dto";
import { evaluate } from "@/lib/grading";
import { ideaProgress, loadGradableQuestion } from "@/lib/grading/question";
import { SubmitSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ questionId: string }>;
}

/**
 * Submit a text answer for one question ("Continue"). Grades via the pluggable
 * grading layer — re-checked here, never trusted from the client — and stores
 * every attempt. The reference/rubric is never returned.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    const { questionId } = await params;
    const { answerText } = SubmitSchema.parse(await req.json());
    const { question, criteria } = await loadGradableQuestion(questionId, user.id);

    const last = await prisma.submission.findFirst({
      where: { questionId, studentId: user.id },
      orderBy: { attemptNumber: "desc" },
    });
    const attemptNumber = (last?.attemptNumber ?? 0) + 1;

    const result = await evaluate({
      prompt: question.prompt,
      reference: question.reference,
      criteria,
      studentAnswer: answerText,
      attemptNumber,
    });

    const submission = await prisma.submission.create({
      data: {
        questionId,
        studentId: user.id,
        attemptNumber,
        answerText,
        score: result.score,
        criteriaScores: JSON.stringify(result.criteriaScores),
        feedback: result.feedback,
        isCorrect: result.isCorrect,
      },
    });

    const completionWhere = {
      assignmentId_studentId: {
        assignmentId: question.assignmentId,
        studentId: user.id,
      },
    };

    // The assignment is complete once every question has a correct attempt.
    // Score: points-weighted average of the best score per question.
    const questions = await prisma.question.findMany({
      where: { assignmentId: question.assignmentId },
      select: {
        points: true,
        submissions: { where: { studentId: user.id }, select: { score: true, isCorrect: true } },
      },
    });
    const allCorrect = questions.every((q) => q.submissions.some((s) => s.isCorrect));
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0) || 1;
    const score =
      questions.reduce((sum, q) => sum + q.points * Math.max(0, ...q.submissions.map((s) => s.score ?? 0)), 0) /
      totalPoints;
    const attempts = questions.reduce((sum, q) => sum + q.submissions.length, 0);

    let completion = await prisma.completion.findUnique({ where: completionWhere });
    if (allCorrect) {
      completion = await prisma.completion.upsert({
        where: completionWhere,
        update: { score, attempts },
        create: { assignmentId: question.assignmentId, studentId: user.id, score, attempts },
      });
    } else if (completion) {
      completion = await prisma.completion.update({
        where: { id: completion.id },
        data: { attempts },
      });
    }

    return ok(
      {
        submission: studentSubmissionDto(submission),
        attemptNumber,
        score: result.score,
        criteriaScores: result.criteriaScores,
        ideas: ideaProgress(result, criteria),
        flaggedIncorrect: result.flaggedIncorrect,
        feedback: result.feedback,
        isCorrect: result.isCorrect,
        completion: completion
          ? {
              completedAt: completion.completedAt,
              score: completion.score,
              attempts: completion.attempts,
            }
          : null,
      },
      201,
    );
  });
}
