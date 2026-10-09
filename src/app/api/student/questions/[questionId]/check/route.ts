import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { evaluate } from "@/lib/grading";
import { gradingInput, ideaProgress, loadGradableQuestion } from "@/lib/grading/question";
import { rateLimit } from "@/lib/rateLimit";
import { GRADING_RATE_LIMIT } from "@/lib/constants";
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
    rateLimit(`grading:${user.id}`, GRADING_RATE_LIMIT.max, GRADING_RATE_LIMIT.windowMs);
    const { questionId } = await params;
    const { answerText } = SubmitSchema.parse(await req.json());
    const loaded = await loadGradableQuestion(questionId, user.id);

    const result = await evaluate(gradingInput(loaded, answerText, 1));

    return ok({
      ideas: ideaProgress(result),
      flaggedIncorrect: result.flaggedIncorrect,
      feedback: result.feedback,
      isCorrect: result.isCorrect,
    });
  });
}
