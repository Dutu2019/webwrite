import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireCourseOwner } from "@/lib/guards";
import { handle, notFound, ok } from "@/lib/http";

interface Ctx {
  params: Promise<{ id: string; inviteId: string }>;
}

/** Revoke a pending invite (teacher only). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id, inviteId } = await params;
    const { course } = await requireCourseOwner(req, id);

    const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.courseId !== course.id) {
      throw notFound("Invite not found");
    }

    await prisma.invite.delete({ where: { id: invite.id } });
    return ok({ success: true });
  });
}
