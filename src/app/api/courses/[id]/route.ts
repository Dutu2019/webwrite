import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCourseOwner } from "@/lib/guards";
import { conflict, handle, ok } from "@/lib/http";
import { courseDto, publicUser } from "@/lib/dto";
import { CourseUpdateSchema } from "@/lib/validation/schemas";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course } = await requireCourseOwner(req, id);

    const full = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        enrollments: { include: { student: true }, orderBy: { createdAt: "asc" } },
        invites: { include: { student: true }, orderBy: { createdAt: "desc" } },
        _count: { select: { enrollments: true, assignments: true } },
      },
    });
    if (!full) throw new Error("Course disappeared");

    return ok({
      course: {
        ...courseDto(full),
        enrollments: full.enrollments.map((e) => ({
          id: e.id,
          status: e.status,
          student: publicUser(e.student),
        })),
        invites: full.invites.map((i) => ({
          id: i.id,
          status: i.status,
          student: publicUser(i.student),
        })),
      },
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course } = await requireCourseOwner(req, id);
    const body = CourseUpdateSchema.parse(await req.json());

    try {
      const updated = await prisma.course.update({
        where: { id: course.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description?.trim() || null }
            : {}),
          ...(body.joinCode !== undefined ? { joinCode: body.joinCode } : {}),
        },
        include: { _count: { select: { enrollments: true, assignments: true } } },
      });
      return ok({ course: courseDto(updated) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw conflict("That class code is already in use");
      }
      throw e;
    }
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { course } = await requireCourseOwner(req, id);
    await prisma.course.delete({ where: { id: course.id } });
    return ok({ success: true });
  });
}
