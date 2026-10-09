import type { Question } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertEnrolled } from "@/lib/guards";
import { forbidden, notFound } from "@/lib/http";
import { assignmentStatus, parseJson } from "@/lib/dto";
import { DEFAULT_CRITERIA } from "@/lib/constants";
import { evaluate, type HintInput } from "./index";
import { parseChoiceAnswer } from "./choice";
import type { ChoiceOption, Criterion, GradingInput, GradingResult } from "./types";

/**
 * Load a question a student may answer (published, not closed, and they're
 * enrolled), plus the criteria it is graded against.
 */
export async function loadGradableQuestion(questionId: string, studentId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { assignment: true },
  });
  if (!question || !question.assignment.published) {
    throw notFound("Question not found");
  }
  await assertEnrolled(studentId, question.assignment.courseId);
  if (assignmentStatus(question.assignment) === "CLOSED") {
    throw forbidden("This assignment is closed");
  }
  return { question, criteria: criteriaOf(question), choices: choicesOf(question) };
}

/** The options of a multiple-choice question, or null for text questions. */
export function choicesOf(question: Pick<Question, "type" | "options">): ChoiceOption[] | null {
  if (question.type !== "MULTIPLE_CHOICE") return null;
  return parseJson<ChoiceOption[] | null>(question.options, null);
}

export function criteriaOf(question: Pick<Question, "criteria">): Criterion[] {
  const criteria = parseJson<Criterion[] | null>(question.criteria, null);
  return criteria?.length ? criteria : DEFAULT_CRITERIA.map((c) => ({ ...c }));
}

/**
 * Everything `evaluate()` needs for one answer. Essays have no single right
 * answer, so they skip the "states something incorrect" check — otherwise a
 * defensible position could be flagged and block completion.
 */
export function gradingInput(
  loaded: Awaited<ReturnType<typeof loadGradableQuestion>>,
  studentAnswer: string,
  attemptNumber: number,
): GradingInput {
  const { question, criteria, choices } = loaded;
  return {
    prompt: question.prompt,
    reference: question.reference,
    criteria,
    choices,
    studentAnswer,
    attemptNumber,
    checkIncorrect: question.type !== "ESSAY",
  };
}

/**
 * Student-safe per-idea progress: positional labels ("Idea 1") and statuses.
 * Never the idea text or the teacher's hints; hints come from the gated
 * /hint route.
 */
export function ideaProgress(result: GradingResult) {
  return result.criteriaScores.map((score, i) => ({
    label: `Idea ${i + 1}`,
    status: score.status,
  }));
}

/**
 * What Gemma needs to write a hint for one answer: the key ideas and how far
 * the answer has got on each (text questions), or the option texts (multiple
 * choice). Text answers are graded first; live checks usually cached that.
 */
export async function hintInput(
  loaded: Awaited<ReturnType<typeof loadGradableQuestion>>,
  studentAnswer: string,
  attemptNumber: number,
): Promise<HintInput> {
  const { question, criteria, choices } = loaded;
  const base = { prompt: question.prompt, reference: question.reference };

  if (choices?.length) {
    const picked = new Set(parseChoiceAnswer(studentAnswer));
    const chosen = choices.filter((o) => picked.has(o.id)).map((o) => o.text);
    return {
      ...base,
      options: choices.map((o) => o.text),
      studentAnswer: chosen.length ? `Chose: ${chosen.join("; ")}` : "No option chosen",
    };
  }

  const result = await evaluate(gradingInput(loaded, studentAnswer, attemptNumber));
  return {
    ...base,
    studentAnswer,
    essay: question.type === "ESSAY",
    ideas: criteria.map((c, i) => ({
      idea: c.description || c.key,
      status: result.criteriaScores[i]?.status ?? "not_completed",
      ...(c.hint ? { teacherHint: c.hint } : {}),
    })),
  };
}
