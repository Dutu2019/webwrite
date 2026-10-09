import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { handle, notFound, ok } from "@/lib/http";
import { courseDto } from "@/lib/dto";
import { JoinSchema } from "@/lib/validation/schemas";

/** Student joins a course using its shareable join code. Idempotent. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(req, "STUDENT");
    const { joinCode } = JoinSchema.parse(await req.json());

    const course = await prisma.course.findUnique({
      where: { joinCode: joinCode.trim().toUpperCase() },
    });
    if (!course) throw notFound("No course matches that join code");

    const enrollment = await prisma.enrollment.upsert({
      where: {
        courseId_studentId: { courseId: course.id, studentId: user.id },
      },
      update: { status: "ACTIVE" },
      create: { courseId: course.id, studentId: user.id, status: "ACTIVE" },
    });

    return ok({
      course: courseDto(course),
      enrollment: { id: enrollment.id, status: enrollment.status },
    });
  });
}
