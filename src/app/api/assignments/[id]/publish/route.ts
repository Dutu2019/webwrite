import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { badRequest, forbidden, handle, notFound, ok } from "@/lib/http";
import { assignmentDto } from "@/lib/dto";
import { PublishSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** Publish or unpublish an assignment (teacher, owner only). */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireRole(req, "TEACHER");

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!assignment) throw notFound("Assignment not found");
    if (assignment.course.teacherId !== user.id) {
      throw forbidden("You do not own this assignment");
    }

    const { published } = PublishSchema.parse(await req.json());

    if (published) {
      const questionCount = await prisma.question.count({ where: { assignmentId: assignment.id } });
      if (questionCount === 0) {
        throw badRequest("Add at least one question before making this assignment public");
      }
    }

    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        published,
        publishedAt: published
          ? assignment.publishedAt ?? new Date()
          : assignment.publishedAt,
      },
    });

    return ok({ assignment: assignmentDto(updated) });
  });
}
