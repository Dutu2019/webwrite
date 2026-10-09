import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { forbidden, handle, ok } from "@/lib/http";
import { hintWithGemma } from "@/lib/grading";
import { hintInput, loadGradableQuestion } from "@/lib/grading/question";
import { rateLimit } from "@/lib/rateLimit";
import { GRADING_RATE_LIMIT, HINT_MIN_ATTEMPTS } from "@/lib/constants";
import { HintSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ questionId: string }>;
}

/**
 * A constructive hint from Gemma on the student's current answer. Unlocks
 * after HINT_MIN_ATTEMPTS submissions, so students try on their own first.
 * Stores nothing and never returns the reference.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    rateLimit(`grading:${user.id}`, GRADING_RATE_LIMIT.max, GRADING_RATE_LIMIT.windowMs);
    const { questionId } = await params;
    const body = HintSchema.parse(await req.json());
    const loaded = await loadGradableQuestion(questionId, user.id);

    const attempts = await prisma.submission.count({ where: { questionId, studentId: user.id } });
    if (attempts < HINT_MIN_ATTEMPTS) {
      throw forbidden(`Hints unlock after ${HINT_MIN_ATTEMPTS} submissions.`);
    }

    let answerText = body.answerText?.trim();
    if (!answerText) {
      const latest = await prisma.submission.findFirst({
        where: { questionId, studentId: user.id },
        orderBy: { attemptNumber: "desc" },
        select: { answerText: true },
      });
      answerText = latest?.answerText ?? "";
    }

    const input = await hintInput(loaded, answerText, attempts + 1);
    const hint = await hintWithGemma({ ...input, language: body.locale });
    return ok({ hint });
  });
}
