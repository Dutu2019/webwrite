import type { Question } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertEnrolled } from "@/lib/guards";
import { notFound } from "@/lib/http";
import { parseJson } from "@/lib/dto";
import { DEFAULT_CRITERIA } from "@/lib/constants";
import type { Criterion, GradingResult } from "./types";

/**
 * Load a question a student may answer (published, and they're enrolled),
 * plus the criteria it is graded against.
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
  return { question, criteria: criteriaOf(question) };
}

export function criteriaOf(question: Pick<Question, "criteria">): Criterion[] {
  const criteria = parseJson<Criterion[] | null>(question.criteria, null);
  return criteria?.length ? criteria : DEFAULT_CRITERIA.map((c) => ({ ...c }));
}

/**
 * Student-safe per-idea progress: positional labels ("Idea 1") and statuses,
 * plus the teacher's hint for ideas not yet included. Never the idea text.
 */
export function ideaProgress(result: GradingResult, criteria: Criterion[]) {
  return result.criteriaScores.map((score, i) => ({
    label: `Idea ${i + 1}`,
    status: score.status,
    hint: score.status === "included" ? null : (criteria[i]?.hint ?? null),
  }));
}
