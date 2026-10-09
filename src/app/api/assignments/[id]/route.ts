import type { NextRequest } from "next/server";
import type { Assignment, Course } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { conflict, forbidden, handle, notFound, ok } from "@/lib/http";
import { assignmentDto, teacherQuestionDto } from "@/lib/dto";
import { AssignmentUpdateSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ id: string }>;
}

type Owned = Assignment & { course: Course; questions: QuestionRow[] };
type QuestionRow = Awaited<
  ReturnType<typeof prisma.question.findMany>
>[number];

async function loadOwned(req: NextRequest, id: string): Promise<Owned> {
  const user = await requireRole(req, "TEACHER");
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { course: true, questions: { orderBy: { order: "asc" } } },
  });
  if (!assignment) throw notFound("Assignment not found");
  if (assignment.course.teacherId !== user.id) {
    throw forbidden("You do not own this assignment");
  }
  return assignment as Owned;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const assignment = await loadOwned(req, id);
    return ok({
      assignment: {
        ...assignmentDto(assignment),
        questions: assignment.questions.map(teacherQuestionDto),
      },
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const assignment = await loadOwned(req, id);
    const body = AssignmentUpdateSchema.parse(await req.json());

    if (body.questions && assignment.published) {
      throw conflict(
        "Questions cannot be changed after an assignment is published; unpublish it first.",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.questions) {
        await tx.question.deleteMany({ where: { assignmentId: assignment.id } });
      }
      return tx.assignment.update({
        where: { id: assignment.id },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description?.trim() || null }
            : {}),
          ...(body.dueAt !== undefined
            ? { dueAt: body.dueAt ? new Date(body.dueAt) : null }
            : {}),
          ...(body.questions
            ? {
                questions: {
                  create: body.questions.map((q, i) => ({
                    order: q.order ?? i,
                    prompt: q.prompt,
                    reference: q.reference,
                    criteria: q.criteria ? JSON.stringify(q.criteria) : null,
                    points: q.points,
                  })),
                },
              }
            : {}),
        },
        include: { questions: { orderBy: { order: "asc" } } },
      });
    });

    return ok({
      assignment: {
        ...assignmentDto(updated),
        questions: updated.questions.map(teacherQuestionDto),
      },
    });
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const assignment = await loadOwned(req, id);
    await prisma.assignment.delete({ where: { id: assignment.id } });
    return ok({ success: true });
  });
}
