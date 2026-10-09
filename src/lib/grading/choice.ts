import type { ChoiceOption, GradingResult } from "./types";

/**
 * Parse a multiple-choice answer: the chosen option ids, comma-separated
 * ("b" or "a,c") or as a JSON array (["a","c"]).
 */
export function parseChoiceAnswer(answer: string): string[] {
  const text = answer.trim();
  if (text.startsWith("[")) {
    try {
      const ids = JSON.parse(text);
      if (Array.isArray(ids)) return ids.map(String);
    } catch {
      /* fall through to comma parsing */
    }
  }
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Exact marking for multiple choice. Correct only when the chosen set equals
 * the correct set; partial credit for "select all that apply" questions is
 * (right picks − wrong picks) / correct options. Never reveals the answer.
 */
export function gradeChoice(options: ChoiceOption[], answer: string): GradingResult {
  const picked = new Set(parseChoiceAnswer(answer).filter((id) => options.some((o) => o.id === id)));
  const correct = options.filter((o) => o.correct);
  const hits = correct.filter((o) => picked.has(o.id)).length;
  const wrong = [...picked].filter((id) => !correct.some((o) => o.id === id)).length;

  const isCorrect = hits === correct.length && wrong === 0;
  const score = isCorrect ? 100 : Math.max(0, Math.round(((hits - wrong) / correct.length) * 100));

  let feedback = "Correct.";
  if (!isCorrect) {
    if (picked.size === 0) feedback = "Choose an option.";
    else if (correct.length > 1 && hits > 0 && wrong === 0) feedback = "Partly right: more than one option is correct.";
    else feedback = "Not quite. Read the question again and reconsider your choice.";
  }

  return { score, criteriaScores: [], isCorrect, flaggedIncorrect: false, feedback };
}
