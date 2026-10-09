import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { evaluate } from "@/lib/grading";
import { ideaProgress, loadGradableQuestion } from "@/lib/grading/question";
import { SubmitSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ questionId: string }>;
}

/**
 * Live check while the student is still writing. Grades the current text and
 * returns per-idea progress, but stores nothing and doesn't count as an
 * attempt — "Continue" (the submit route) records the final answer.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    const { questionId } = await params;
    const { answerText } = SubmitSchema.parse(await req.json());
    const { question, criteria } = await loadGradableQuestion(questionId, user.id);

    const result = await evaluate({
      prompt: question.prompt,
      reference: question.reference,
      criteria,
      studentAnswer: answerText,
      attemptNumber: 1,
    });

    return ok({
      ideas: ideaProgress(result, criteria),
      flaggedIncorrect: result.flaggedIncorrect,
      feedback: result.feedback,
      isCorrect: result.isCorrect,
    });
  });
}
