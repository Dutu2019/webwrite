import { createHash } from "node:crypto";
import { HttpError } from "../http";
import type {
  CriteriaScore,
  Criterion,
  CriterionStatus,
  GradingInput,
  GradingResult,
} from "./types";

/**
 * Grades an answer through the Gemma decision service (the `gemma/` project):
 * every criterion and an "is anything wrong?" check are asked in ONE batch call.
 */

const BATCH_URL = process.env.GEMMA_BATCH_URL ?? "http://127.0.0.1:8000/v1/decide/batch";
const TIMEOUT_MS = 65_000;
const CACHE_LIMIT = 500;

/** Ordered rubric levels; the index the model returns maps onto STATUSES. */
const LEVELS = [
  "Not completed: the idea is missing, or stated incorrectly.",
  "In progress: the idea is touched on but vague, incomplete, or only implied.",
  "Included: the idea is stated clearly and correctly.",
];
const STATUSES: CriterionStatus[] = ["not_completed", "in_progress", "included"];
const STATUS_SCORE: Record<CriterionStatus, number> = {
  not_completed: 0,
  in_progress: 50,
  included: 100,
};

const INCORRECT_CHECK = "incorrect";

interface BatchAnswer {
  value: boolean | number | string | null;
}

function ideaName(index: number) {
  return `idea_${index}`;
}

function batchRequest(input: GradingInput, criteria: Criterion[]) {
  const questions: Record<string, object> = {};
  criteria.forEach((c, i) => {
    questions[ideaName(i)] = {
      kind: "score",
      instructions:
        `Key idea: ${c.description || c.key}\n` +
        "How fully does the student explanation state this idea, correctly and in their own words?",
      rubric: LEVELS,
    };
  });
  questions[INCORRECT_CHECK] = {
    kind: "boolean",
    condition:
      "The student explanation states something factually incorrect about the question's topic. " +
      "Missing detail, spelling, and grammar do not count as incorrect.",
  };

  return {
    // Teacher text and student text are kept in separate JSON fields so the
    // student can't blur the boundary; the service treats the context as data.
    context: JSON.stringify({
      question: input.prompt,
      reference: input.reference,
      studentExplanation: input.studentAnswer,
    }),
    questions,
  };
}

async function callService(body: object): Promise<Record<string, BatchAnswer>> {
  let res: Response;
  try {
    res = await fetch(BATCH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(503, "GRADING_UNAVAILABLE", "Grading is unavailable right now. Try again.");
  }

  if (res.status === 422) {
    throw new HttpError(422, "GRADING_INPUT_INVALID", "This question or answer is too long to grade.");
  }
  if (!res.ok) {
    throw new HttpError(503, "GRADING_UNAVAILABLE", "Grading is unavailable right now. Try again.");
  }
  const data = (await res.json()) as { answers?: Record<string, BatchAnswer> };
  if (!data.answers) {
    throw new HttpError(503, "GRADING_UNAVAILABLE", "Grading returned an unexpected response.");
  }
  return data.answers;
}

function statusOf(answer: BatchAnswer | undefined): CriterionStatus {
  // null = the model couldn't tell from the answer → not completed yet.
  return typeof answer?.value === "number" ? STATUSES[answer.value] ?? "not_completed" : "not_completed";
}

function feedbackFor(criteria: Criterion[], scores: CriteriaScore[], flaggedIncorrect: boolean) {
  if (flaggedIncorrect) {
    return "Part of your explanation isn't accurate. Re-read it and fix what's wrong.";
  }
  const next = scores.findIndex((s) => s.status !== "included");
  if (next === -1) return "All key ideas included.";
  if (criteria[next].hint) return criteria[next].hint!;
  return scores[next].status === "in_progress"
    ? `You're close on Idea ${next + 1}. Be more specific.`
    : "Add more detail.";
}

async function grade(input: GradingInput): Promise<GradingResult> {
  const criteria = input.criteria ?? [];
  const answers = await callService(batchRequest(input, criteria));

  const criteriaScores: CriteriaScore[] = criteria.map((c, i) => {
    const status = statusOf(answers[ideaName(i)]);
    return { key: c.key, weight: c.weight ?? 1, score: STATUS_SCORE[status], status };
  });

  const totalWeight = criteriaScores.reduce((sum, c) => sum + c.weight, 0);
  const score =
    totalWeight > 0
      ? Math.round(criteriaScores.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight)
      : 0;
  const flaggedIncorrect = answers[INCORRECT_CHECK]?.value === true;

  return {
    score,
    criteriaScores,
    isCorrect:
      criteriaScores.length > 0 &&
      criteriaScores.every((c) => c.status === "included") &&
      !flaggedIncorrect,
    flaggedIncorrect,
    feedback: feedbackFor(criteria, criteriaScores, flaggedIncorrect),
  };
}

// Live checks re-send the same text often (and Continue re-grades the final
// text), so identical inputs share one in-flight or finished result.
const cache = new Map<string, Promise<GradingResult>>();

export function gemmaGrade(input: GradingInput): Promise<GradingResult> {
  const key = createHash("sha256")
    .update(JSON.stringify([input.prompt, input.reference, input.criteria ?? [], input.studentAnswer]))
    .digest("hex");

  const cached = cache.get(key);
  if (cached) return cached;

  const result = grade(input);
  cache.set(key, result);
  result.catch(() => cache.delete(key)); // never cache failures
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return result;
}
