import { z } from "zod";
import { QUESTION_TYPES } from "@/lib/constants";

export const RoleSchema = z.enum(["TEACHER", "STUDENT"]);

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  role: RoleSchema,
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Teacher-chosen class code, e.g. "HIST200". Stored upper-case. */
export const JoinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{3,16}$/, "Use 3–16 letters or digits");

export const CourseCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  joinCode: JoinCodeSchema.optional(), // generated when omitted
});

export const CourseUpdateSchema = CourseCreateSchema.partial();

export const JoinSchema = z.object({
  joinCode: z.string().min(1).max(32),
});

export const InviteSchema = z.object({
  studentId: z.string().min(1),
});

export const CriterionSchema = z.object({
  key: z.string().min(1).max(64),
  weight: z.number().min(0).max(1).default(1),
  description: z.string().max(500).optional(),
  hint: z.string().max(500).optional(),
});

export const ChoiceOptionSchema = z.object({
  id: z.string().min(1).max(32),
  text: z.string().trim().min(1).max(2000),
  correct: z.boolean().default(false),
});

export const QuestionInputSchema = z
  .object({
    type: z.enum(QUESTION_TYPES).default("SHORT_ANSWER"),
    prompt: z.string().min(1).max(20000),
    reference: z.string().min(1).max(20000),
    criteria: z.array(CriterionSchema).max(20).optional(),
    options: z.array(ChoiceOptionSchema).max(20).optional(),
    points: z.number().int().positive().max(1000).default(1),
    order: z.number().int().min(0).max(1000).optional(),
  })
  .refine((q) => q.type !== "KEY_IDEAS" || q.criteria?.some((c) => c.description?.trim()), {
    message: "Key-ideas questions need at least one idea",
    path: ["criteria"],
  })
  .refine(
    (q) =>
      q.type !== "MULTIPLE_CHOICE" ||
      ((q.options?.length ?? 0) >= 2 &&
        q.options!.some((o) => o.correct) &&
        new Set(q.options!.map((o) => o.id)).size === q.options!.length),
    { message: "Multiple-choice questions need 2+ options with unique ids and at least one correct", path: ["options"] },
  );

export const AssignmentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  dueAt: z.string().datetime().nullish(),
  // May start empty (a draft); publishing requires at least one question.
  questions: z.array(QuestionInputSchema).max(200).default([]),
});

export const AssignmentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullish(),
  dueAt: z.string().datetime().nullish(),
  questions: z.array(QuestionInputSchema).max(200).optional(),
});

export const PublishSchema = z.object({
  published: z.boolean(),
});

export const SubmitSchema = z.object({
  answerText: z.string().min(1).max(20000),
});

/** The current draft to hint on; omitted → the latest submission. */
export const HintSchema = z.object({
  answerText: z.string().max(20000).optional(),
});

export const StudentSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export type Criterion = z.infer<typeof CriterionSchema>;
export type QuestionInput = z.infer<typeof QuestionInputSchema>;
