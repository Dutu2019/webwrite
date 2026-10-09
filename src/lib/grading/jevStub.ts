import type { Criterion, CriteriaScore, GradingInput, GradingResult } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this",
  "these", "those", "is", "are", "was", "were", "be", "been", "being", "to",
  "of", "in", "on", "at", "for", "with", "by", "from", "as", "it", "its",
  "you", "your", "my", "we", "our", "they", "their", "he", "she", "his",
  "her", "them", "will", "would", "can", "could", "should", "may", "might",
  "must", "do", "does", "did", "not", "no", "yes", "so", "into", "about",
  "over", "under", "when", "where", "which", "who", "whom", "what", "how",
  "why", "there", "here", "also", "very", "more", "most", "some", "any",
]);

const CONNECTIVES = [
  "because", "therefore", "thus", "hence", "however", "although", "though",
  "since", "so that", "in order to", "for example", "for instance",
  "furthermore", "moreover", "consequently", "as a result", "leads to",
  "implies", "suggests", "first", "second", "finally",
];

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function contentWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []
  );
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Internal only: overlap between answer and reference is never echoed back. */
function conceptOverlap(answer: string, reference: string): number {
  const ref = new Set(contentWords(reference));
  if (ref.size === 0) return 0;
  const ans = new Set(contentWords(answer));
  let hits = 0;
  for (const w of ans) if (ref.has(w)) hits++;
  return clamp((hits / ref.size) * 100);
}

function completeness(answer: string, reference: string): number {
  const ans = contentWords(answer);
  const ref = new Set(contentWords(reference));
  const target = Math.max(12, Math.round(ref.size * 0.6));
  const lengthScore = clamp((ans.length / target) * 100);
  const overlap = conceptOverlap(answer, reference);
  return Math.round(0.55 * lengthScore + 0.45 * overlap);
}

function elaboration(answer: string): number {
  const sents = sentences(answer);
  const words = contentWords(answer);
  const lower = answer.toLowerCase();
  const sentenceScore = clamp((sents.length / 4) * 100);
  const connectiveHits = CONNECTIVES.filter((c) => lower.includes(c)).length;
  const reasoningScore = clamp((connectiveHits / 2) * 100);
  const avgLen = sents.length ? words.length / sents.length : words.length;
  const depthScore = clamp((avgLen / 15) * 100);
  return Math.round(0.4 * sentenceScore + 0.3 * reasoningScore + 0.3 * depthScore);
}

function clarity(answer: string): number {
  const sents = sentences(answer);
  if (sents.length === 0) return 0;
  const hasPunctuation = /[.!?]/.test(answer.trim());
  const longSentencePenalty = sents.some((s) => s.split(/\s+/).length > 45) ? 15 : 0;
  return clamp(40 + sents.length * 8 + (hasPunctuation ? 12 : 0) - longSentencePenalty);
}

function accuracy(answer: string, reference: string): number {
  return Math.round(0.5 * conceptOverlap(answer, reference) + 0.5 * completeness(answer, reference));
}

function generic(answer: string, reference: string): number {
  return Math.round(0.5 * completeness(answer, reference) + 0.5 * elaboration(answer));
}

const EVALUATORS: Record<string, (a: string, r: string) => number> = {
  completeness,
  coverage: completeness,
  elaboration,
  detail: elaboration,
  depth: elaboration,
  clarity,
  organization: clarity,
  accuracy,
  correctness: accuracy,
  precision: accuracy,
};

interface Hint {
  early: string;
  mid: string;
  late: string;
}

const HINTS: Record<string, Hint> = {
  completeness: {
    early: "You're on the right track. Try to cover a bit more of what the question is asking.",
    mid: "You've started, but some required ideas are still missing — what else does the prompt ask for?",
    late: "The main gap is coverage: part of the question is unaddressed. List each thing the prompt requires and check it off.",
  },
  elaboration: {
    early: "Nice start. Add a sentence or two explaining *why*, not just *what*.",
    mid: "Develop the reasoning: connect your points with words like 'because' or 'therefore'.",
    late: "The missing piece is explanation — claims are stated but not justified. Walk through the reasoning step by step.",
  },
  clarity: {
    early: "Your idea comes across. Try shortening sentences and using punctuation to structure it.",
    mid: "Break your answer into clearer sentences, one idea per sentence.",
    late: "Reorganize for clarity: state the point, then support it, one idea at a time.",
  },
  accuracy: {
    early: "You're close. Double-check the key details against the concepts involved.",
    mid: "Some specifics look off. Re-examine the core idea the question targets.",
    late: "Focus on precision: verify the central terms and their relationships before expanding.",
  },
};

const GENERIC_HINTS: Hint = {
  early: "Good effort — think about what a complete answer would need to include.",
  mid: "Add more substance and explicitly justify your reasoning.",
  late: "Identify the single weakest part of your answer and rewrite just that part with more support.",
};

function pickHint(key: string, attemptNumber: number): string {
  const band = attemptNumber <= 2 ? "early" : attemptNumber <= 4 ? "mid" : "late";
  const hint = HINTS[key] ?? GENERIC_HINTS;
  return hint[band];
}

function defaultCriteria(): Criterion[] {
  return [
    { key: "completeness", weight: 0.6, description: "How fully the answer addresses the prompt." },
    { key: "elaboration", weight: 0.4, description: "How developed and well-reasoned the answer is." },
  ];
}

/**
 * Deterministic, dependency-free grading stub. It approximates criterion-based
 * scoring so the API is usable today; the real JEV model replaces `evaluate()`.
 * The reference/rubric is used only to compute scores and is never returned.
 */
export function jevStub(input: GradingInput): GradingResult {
  const { studentAnswer, reference, attemptNumber } = input;
  const criteria = input.criteria?.length ? input.criteria : defaultCriteria();

  const criteriaScores: CriteriaScore[] = criteria.map((c) => {
    const evaluator = EVALUATORS[c.key.toLowerCase()] ?? generic;
    const score = evaluator(studentAnswer, reference);
    return {
      key: c.key,
      score,
      weight: c.weight ?? 1,
      status: score >= 80 ? "included" : score >= 40 ? "in_progress" : "not_completed",
    };
  });

  const totalWeight = criteriaScores.reduce((sum, c) => sum + c.weight, 0);
  const weighted =
    totalWeight > 0
      ? criteriaScores.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
      : criteriaScores.reduce((sum, c) => sum + c.score, 0) / criteriaScores.length;

  // Small effort boost for repeated attempts, capped so it can't trivially pass.
  const bonus = Math.min(Math.max(attemptNumber - 1, 0) * 2, 10);
  const score = Math.round(clamp(weighted + bonus));

  const weakest = [...criteriaScores].sort((a, b) => a.score - b.score)[0];
  const feedback = pickHint(weakest?.key ?? "completeness", attemptNumber);

  return {
    score,
    criteriaScores,
    isCorrect: score >= 80,
    flaggedIncorrect: false,
    feedback,
  };
}
