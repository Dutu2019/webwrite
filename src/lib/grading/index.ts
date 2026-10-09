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
 * `GRADING_BACKEND=gemma` grades through the Gemma decision service; otherwise
 * a deterministic local stub is used. Swapping backends needs no call site changes.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  return process.env.GRADING_BACKEND === "gemma" ? gemmaGrade(input) : jevStub(input);
}
