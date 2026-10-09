import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireCourseOwner } from "@/lib/guards";
import { badRequest, conflict, handle, ok } from "@/lib/http";
import { publicUser } from "@/lib/dto";
import { InviteSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** List invites for a course (teacher only). */
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course } = await requireCourseOwner(req, id);

    const invites = await prisma.invite.findMany({
      where: { courseId: course.id },
      include: { student: true },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      invites: invites.map((i) => ({
        id: i.id,
        status: i.status,
        createdAt: i.createdAt,
        student: publicUser(i.student),
      })),
    });
  });
}

/** Invite an existing student by id (the "find a student by name" backup path). */
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course, user } = await requireCourseOwner(req, id);
    const { studentId } = InviteSchema.parse(await req.json());

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== "STUDENT") {
      throw badRequest("No such student");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId } },
    });
    if (enrollment && enrollment.status === "ACTIVE") {
      throw conflict("That student is already enrolled in this course");
    }

    const invite = await prisma.invite.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId } },
      update: { status: "PENDING", invitedById: user.id },
      create: {
        courseId: course.id,
        studentId,
        invitedById: user.id,
        status: "PENDING",
      },
    });

    return ok(
      { invite: { id: invite.id, status: invite.status, student: publicUser(student) } },
      201,
    );
  });
}
