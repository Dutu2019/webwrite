import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { conflict, handle, notFound, ok } from "@/lib/http";
import { courseDto } from "@/lib/dto";

interface Ctx {
  params: Promise<{ inviteId: string }>;
}

/** Accept an invite and become actively enrolled. */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    const { inviteId } = await params;

    const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.studentId !== user.id) {
      throw notFound("Invite not found");
    }
    if (invite.status === "REVOKED") {
      throw conflict("This invite has been revoked");
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        courseId_studentId: { courseId: invite.courseId, studentId: user.id },
      },
      update: { status: "ACTIVE" },
      create: { courseId: invite.courseId, studentId: user.id, status: "ACTIVE" },
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });

    const course = await prisma.course.findUnique({
      where: { id: invite.courseId },
    });

    return ok({
      course: course ? courseDto(course) : null,
      enrollment: { id: enrollment.id, status: enrollment.status },
    });
  });
}
