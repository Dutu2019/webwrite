import type { GradingInput, GradingResult } from "./types";
import { gradeChoice } from "./choice";
import { jevStub } from "./jevStub";

export type {
  ChoiceOption,
  Criterion,
  CriteriaScore,
  GradingInput,
  GradingResult,
} from "./types";

/**
 * Grade a single text answer. This is the only entry point call sites use.
 *
 * Today it delegates to a deterministic local stub. When the real JEV model is
 * available, replace the body (or swap the import) — no call site changes.
 */
export async function evaluate(input: GradingInput): Promise<GradingResult> {
  // Multiple choice is marked exactly; only free text goes to the model
  if (input.choices?.length) return gradeChoice(input.choices, input.studentAnswer);
  return jevStub(input);
}
