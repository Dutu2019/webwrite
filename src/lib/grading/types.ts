/**
 * Grading layer contracts. The real JEV model will implement `GradingResult`;
 * call sites only depend on these types so the stub can be swapped out.
 */

export interface Criterion {
  key: string;
  weight?: number;
  description?: string;
}

export interface CriteriaScore {
  key: string;
  score: number; // 0–100
  weight: number;
}

export interface GradingInput {
  prompt: string;
  reference: string;
  criteria?: Criterion[] | null;
  studentAnswer: string;
  attemptNumber: number;
}

export interface GradingResult {
  score: number; // weighted aggregate 0–100
  criteriaScores: CriteriaScore[];
  isCorrect: boolean;
  feedback: string;
}
