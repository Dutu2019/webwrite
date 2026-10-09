import type { GradingInput, GradingResult } from "./types";
import { gradeWithGemma } from "./gemma";

export type {
  Criterion,
  CriteriaScore,
  CriterionStatus,
  GradingInput,
  GradingResult,
} from "./types";
export { decideBatch, gradeWithGemma } from "./gemma";
export type { Question, Answer } from "./gemma";

/**
 * Grade a single text answer against the question's criteria using hosted
 * Gemma 4 (via the Gemini API). This is the only entry point call sites use.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  return gradeWithGemma(input);
}
