import type { Assignment, Course, Question, Submission, User } from "@prisma/client";
import { DEFAULT_CRITERIA } from "./constants";

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
    prompt: q.prompt,
    reference: q.reference,
    criteria: parseJson<unknown>(q.criteria, null),
    points: q.points,
  };
}

/**
 * Student view of a question — deliberately strips `reference` and `criteria`
 * so the answer key never leaves the server. Only positional idea labels
 * ("Idea 1", …) are exposed, never the idea text.
 */
export function studentQuestionDto(
  q: Pick<Question, "id" | "order" | "prompt" | "points" | "criteria">,
) {
  const ideaCount =
    parseJson<unknown[] | null>(q.criteria, null)?.length || DEFAULT_CRITERIA.length;
  return {
    id: q.id,
    order: q.order,
    prompt: q.prompt,
    points: q.points,
    ideas: Array.from({ length: ideaCount }, (_, i) => ({ label: `Idea ${i + 1}` })),
  };
}

/** Student view of one of their own submission attempts. */
export function studentSubmissionDto(s: Submission) {
  return {
    id: s.id,
    questionId: s.questionId,
    attemptNumber: s.attemptNumber,
    answerText: s.answerText,
    score: s.score,
    criteriaScores: parseJson<unknown>(s.criteriaScores, []),
    feedback: s.feedback,
    isCorrect: s.isCorrect,
    createdAt: s.createdAt,
  };
}

/** Teacher view of a student's submission. */
export function teacherSubmissionDto(s: Submission) {
  return {
    ...studentSubmissionDto(s),
    studentId: s.studentId,
  };
}
