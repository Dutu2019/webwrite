import type { Assignment, Course, Question, Submission, User } from "@prisma/client";
import { DEFAULT_CRITERIA } from "./constants";
import type { ChoiceOption } from "./grading/types";

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Safe user shape (never includes passwordHash). */
export function publicUser(
  u: Pick<User, "id" | "email" | "name" | "role" | "createdAt">,
) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  };
}

interface CourseCounts {
  enrollments?: number;
  assignments?: number;
}

export function courseDto(
  course: Pick<
    Course,
    "id" | "name" | "description" | "joinCode" | "teacherId" | "createdAt" | "updatedAt"
  > & { _count?: CourseCounts },
) {
  const dto: Record<string, unknown> = {
    id: course.id,
    name: course.name,
    description: course.description,
    joinCode: course.joinCode,
    teacherId: course.teacherId,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
  if (course._count) {
    dto.counts = {
      enrollments: course._count.enrollments ?? 0,
      assignments: course._count.assignments ?? 0,
    };
  }
  return dto;
}

export type AssignmentStatus = "CREATED" | "POSTED" | "CLOSED";

/** CREATED until published; POSTED once published; CLOSED once its due date passes. */
export function assignmentStatus(
  a: Pick<Assignment, "published" | "dueAt">,
  now = new Date(),
): AssignmentStatus {
  if (!a.published) return "CREATED";
  if (a.dueAt && a.dueAt <= now) return "CLOSED";
  return "POSTED";
}

export function assignmentDto(
  a: Pick<
    Assignment,
    | "id"
    | "courseId"
    | "title"
    | "description"
    | "published"
    | "publishedAt"
    | "dueAt"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return {
    id: a.id,
    courseId: a.courseId,
    title: a.title,
    description: a.description,
    published: a.published,
    publishedAt: a.publishedAt,
    dueAt: a.dueAt,
    status: assignmentStatus(a),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/** Teacher view of a question — includes the answer key / rubric. */
export function teacherQuestionDto(q: Question) {
  return {
    id: q.id,
    assignmentId: q.assignmentId,
    order: q.order,
    type: q.type,
    prompt: q.prompt,
    reference: q.reference,
    criteria: parseJson<unknown>(q.criteria, null),
    options: parseJson<ChoiceOption[] | null>(q.options, null),
    points: q.points,
  };
}

/**
 * Student view of a question — deliberately strips `reference`, `criteria`
 * and which options are correct, so the answer key never leaves the server.
 * Only positional idea labels ("Idea 1", …) are exposed, never the idea text.
 */
export function studentQuestionDto(
  q: Pick<Question, "id" | "order" | "type" | "prompt" | "points" | "criteria" | "options">,
) {
  const choice = q.type === "MULTIPLE_CHOICE";
  const ideaCount = choice
    ? 0
    : parseJson<unknown[] | null>(q.criteria, null)?.length || DEFAULT_CRITERIA.length;
  const options = parseJson<ChoiceOption[] | null>(q.options, null);
  return {
    id: q.id,
    order: q.order,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    ideas: Array.from({ length: ideaCount }, (_, i) => ({ label: `Idea ${i + 1}` })),
    ...(choice && options
      ? {
          options: options.map((o) => ({ id: o.id, text: o.text })),
          // Lets the UI use checkboxes instead of radio buttons, without saying which
          multipleAnswers: options.filter((o) => o.correct).length > 1,
        }
      : {}),
  };
}

interface StoredCriteriaScore {
  key: string;
  score: number;
  weight: number;
  status?: string;
}

/**
 * Student view of per-criterion scores. Teacher-chosen keys can describe the
 * idea itself, so students get positional labels ("Idea 1", …) instead.
 */
export function studentCriteriaScores(scores: StoredCriteriaScore[]) {
  return scores.map((c, i) => ({
    label: `Idea ${i + 1}`,
    score: c.score,
    weight: c.weight,
    status: c.status ?? null,
  }));
}

/** Student view of one of their own submission attempts. */
export function studentSubmissionDto(s: Submission) {
  return {
    id: s.id,
    questionId: s.questionId,
    attemptNumber: s.attemptNumber,
    answerText: s.answerText,
    score: s.score,
    criteriaScores: studentCriteriaScores(parseJson<StoredCriteriaScore[]>(s.criteriaScores, [])),
    feedback: s.feedback,
    isCorrect: s.isCorrect,
    createdAt: s.createdAt,
  };
}

/** Teacher view of a student's submission, with the real criterion keys. */
export function teacherSubmissionDto(s: Submission) {
  return {
    ...studentSubmissionDto(s),
    criteriaScores: parseJson<StoredCriteriaScore[]>(s.criteriaScores, []),
    studentId: s.studentId,
  };
}
