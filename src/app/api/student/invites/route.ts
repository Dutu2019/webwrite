import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { courseDto, publicUser } from "@/lib/dto";

/** Pending invites addressed to the current student. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");

    const invites = await prisma.invite.findMany({
      where: { studentId: user.id, status: "PENDING" },
      include: { course: { include: { teacher: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      invites: invites.map((i) => ({
        id: i.id,
        status: i.status,
        createdAt: i.createdAt,
        course: {
          ...courseDto(i.course),
          teacher: publicUser(i.course.teacher),
        },
      })),
    });
  });
}
