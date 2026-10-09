import type { QuestionType } from "@/lib/constants";

export type { QuestionType };

/** A grading criterion as the API stores it (see src/lib/grading/types.ts). */
export interface Criterion {
  key: string;
  weight?: number;
  description?: string;
  hint?: string;
}

/** A question as GET /api/assignments/:id returns it to the owning teacher. */
export interface TeacherQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  reference: string;
  criteria: Criterion[] | null;
  options: ChoiceOption[] | null;
  points: number;
}

/** A multiple-choice option; `correct` stays on the server for students. */
export interface ChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}

/** One key idea a KEY_IDEAS answer must contain, plus an optional nudge for students. */
export interface Idea {
  text: string;
  hint: string;
}

/**
 * Editable state of one question in the builder. Every type shares this shape,
 * so switching a question's type keeps what was already written.
 */
export interface QuestionDraft {
  uid: string; // local only; server ids change on every save
  type: QuestionType;
  prompt: string;
  points: number;
  reference: string;
  ideas: Idea[];
  options: ChoiceOption[];
  /** Criteria loaded from the server for non-idea types, sent back unchanged. */
  keptCriteria: Criterion[] | null;
}

export interface DraftErrors {
  prompt?: string;
  reference?: string;
  points?: string;
  ideas?: string;
  ideaErrors?: (string | undefined)[];
  options?: string;
  optionErrors?: (string | undefined)[];
}

/** What the API's question input needs beyond the shared fields. */
export interface TypePayload {
  reference: string;
  criteria?: Criterion[];
  options?: ChoiceOption[];
}
