import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { courseDto, publicUser } from "@/lib/dto";

/** Courses the student is actively enrolled in. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.id, status: "ACTIVE" },
      include: {
        course: {
          include: {
            teacher: true,
            _count: { select: { assignments: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      courses: enrollments.map((e) => ({
        ...courseDto(e.course),
        teacher: publicUser(e.course.teacher),
        enrollmentStatus: e.status,
      })),
    });
  });
}
