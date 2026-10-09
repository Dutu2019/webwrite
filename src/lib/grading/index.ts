import type { GradingInput, GradingResult } from "./types";
import { gradeChoice } from "./choice";
import { jevStub } from "./jevStub";
import { gradeWithGemma } from "./gemma";

export type {
  ChoiceOption,
  Criterion,
  CriteriaScore,
  CriterionStatus,
  GradingInput,
  GradingResult,
} from "./types";
export { decideBatch, gradeWithGemma, hintWithGemma } from "./gemma";
export type { Question, Answer, HintInput } from "./gemma";

/**
 * Grade a single text answer against the question's criteria using hosted
 * Gemma 4 (via the Gemini API). This is the only entry point call sites use.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  // Multiple choice is marked exactly; only free text goes to the model
  if (input.choices?.length) return gradeChoice(input.choices, input.studentAnswer);
  return process.env.GRADING_BACKEND === "stub" ? jevStub(input) : gradeWithGemma(input);
}
