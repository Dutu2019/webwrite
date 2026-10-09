/** Opaque, unambiguous alphabet (no O/0, I/1). */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

/**
 * Question kinds the builder offers. Text types are graded against
 * `reference`/`criteria`; MULTIPLE_CHOICE is marked exactly against its options.
 */
export const QUESTION_TYPES = ["SHORT_ANSWER", "KEY_IDEAS", "ESSAY", "MULTIPLE_CHOICE"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Aggregate score (0–100) at or above which an answer counts as correct. */
export const CORRECT_THRESHOLD = 80;

/** Per-student cap on grading requests (live checks + submits) per minute. */
export const GRADING_RATE_LIMIT = { max: 30, windowMs: 60_000 };

/** Submissions a student must make on a question before Gemma hints unlock. */
export const HINT_MIN_ATTEMPTS = 3;

/** Fallback criteria when a question doesn't define its own. */
export const DEFAULT_CRITERIA = [
  {
    key: "completeness",
    weight: 0.6,
    description: "How fully the answer addresses the prompt.",
  },
  {
    key: "elaboration",
    weight: 0.4,
    description: "How developed and well-reasoned the answer is.",
  },
] as const;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
