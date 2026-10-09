import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireCourseOwner } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { assignmentDto, teacherQuestionDto } from "@/lib/dto";
import { AssignmentCreateSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course } = await requireCourseOwner(req, id);

    const assignments = await prisma.assignment.findMany({
      where: { courseId: course.id },
      include: { _count: { select: { questions: true, completions: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      assignments: assignments.map((a) => ({
        ...assignmentDto(a),
        counts: { questions: a._count.questions, completions: a._count.completions },
      })),
    });
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course } = await requireCourseOwner(req, id);
    const body = AssignmentCreateSchema.parse(await req.json());

    const assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        questions: {
          create: body.questions.map((q, i) => ({
            order: q.order ?? i,
            prompt: q.prompt,
            reference: q.reference,
            criteria: q.criteria ? JSON.stringify(q.criteria) : null,
            points: q.points,
          })),
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    return ok(
      {
        assignment: {
          ...assignmentDto(assignment),
          questions: assignment.questions.map(teacherQuestionDto),
        },
      },
      201,
    );
  });
}
