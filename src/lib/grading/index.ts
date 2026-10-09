import type { GradingInput, GradingResult } from "./types";
<<<<<<< HEAD
import { gradeWithGemma } from "./gemma";
=======
import { jevStub } from "./jevStub";
import { gemmaGrade } from "./gemma";
>>>>>>> main

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
<<<<<<< HEAD
 * Grade a single text answer against the question's criteria using hosted
 * Gemma 4 (via the Gemini API). This is the only entry point call sites use.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  return gradeWithGemma(input);
=======
 * Grade a single text answer. This is the only entry point call sites use.
 *
 * Grades through the Gemma decision service by default; `GRADING_BACKEND=stub`
 * uses a deterministic offline stub instead. Swapping backends needs no call
 * site changes.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  return process.env.GRADING_BACKEND === "stub" ? jevStub(input) : gemmaGrade(input);
>>>>>>> main
}
