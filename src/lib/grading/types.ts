/**
 * Grading layer contracts. The real JEV model will implement `GradingResult`;
 * call sites only depend on these types so the stub can be swapped out.
 */

/** How far an answer has got on one criterion / key idea. */
export type CriterionStatus = "not_completed" | "in_progress" | "included";

export interface Criterion {
  key: string;
  weight?: number;
  /** For key-idea questions: the idea the answer must contain. SERVER ONLY. */
  description?: string;
  /** Teacher-written nudge shown while this criterion isn't included yet. */
  hint?: string;
}

export interface CriteriaScore {
  key: string;
  score: number; // 0–100
  weight: number;
  status: CriterionStatus;
}

/** One multiple-choice option. `correct` is SERVER ONLY. */
export interface ChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface GradingInput {
  prompt: string;
  reference: string;
  criteria?: Criterion[] | null;
  /** Present for multiple-choice questions; the answer is then the chosen option ids. */
  choices?: ChoiceOption[] | null;
  studentAnswer: string;
  attemptNumber: number;
}

export interface GradingResult {
  score: number; // weighted aggregate 0–100
  criteriaScores: CriteriaScore[];
  isCorrect: boolean;
  /** The answer states something wrong; blocks completion regardless of score. */
  flaggedIncorrect: boolean;
  feedback: string;
}
