import type { GradingInput, GradingResult } from "./types";
import { jevStub } from "./jevStub";
import { gemmaGrade } from "./gemma";

export type {
  Criterion,
  CriteriaScore,
  CriterionStatus,
  GradingInput,
  GradingResult,
} from "./types";

/**
 * Grade a single text answer. This is the only entry point call sites use.
 *
 * Grades through the Gemma decision service by default; `GRADING_BACKEND=stub`
 * uses a deterministic offline stub instead. Swapping backends needs no call
 * site changes.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  return process.env.GRADING_BACKEND === "stub" ? jevStub(input) : gemmaGrade(input);
}
