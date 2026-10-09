import type { QuestionType } from "@/lib/constants";

export type IdeaStatus = "not_completed" | "in_progress" | "included";

/** Per-idea progress from /check or /submit (hints come from the gated /hint route). `label` is the server's English positional label: the UI shows `t.common.idea(n)` instead. */
export interface IdeaProgress {
  label: string;
  status: IdeaStatus;
}

/** What the feedback line under an answer is built from. */
export interface Feedback {
  ideas: IdeaProgress[];
  isCorrect: boolean;
  flaggedIncorrect: boolean;
  feedback: string | null;
}

export interface Attempt {
  id: string;
  attemptNumber: number;
  answerText: string;
  score: number | null;
  /** Positional labels only; criterion keys stay server-side. */
  criteriaScores: { label: string; score: number; status: IdeaStatus | null }[];
  feedback: string | null;
  isCorrect: boolean;
  createdAt: string;
}

/** A question as GET /api/student/assignments/:id returns it (no answer key). */
export interface StudentQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  points: number;
  ideas: { label: string }[];
  options?: { id: string; text: string }[];
  multipleAnswers?: boolean;
  attempts: Attempt[]; // newest first
}
