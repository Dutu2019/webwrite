import { z } from "zod";

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

export const CourseCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
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
});

export const QuestionInputSchema = z.object({
  prompt: z.string().min(1).max(20000),
  reference: z.string().min(1).max(20000),
  criteria: z.array(CriterionSchema).max(20).optional(),
  points: z.number().int().positive().max(1000).default(1),
  order: z.number().int().min(0).max(1000).optional(),
});

export const AssignmentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  dueAt: z.string().datetime().nullish(),
  questions: z.array(QuestionInputSchema).min(1).max(200),
});

export const AssignmentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullish(),
  dueAt: z.string().datetime().nullish(),
  questions: z.array(QuestionInputSchema).min(1).max(200).optional(),
});

export const PublishSchema = z.object({
  published: z.boolean(),
});

export const SubmitSchema = z.object({
  answerText: z.string().min(1).max(20000),
});

export const StudentSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export type Criterion = z.infer<typeof CriterionSchema>;
export type QuestionInput = z.infer<typeof QuestionInputSchema>;
