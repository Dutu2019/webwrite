import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { conflict, handle, ok } from "@/lib/http";
import { courseDto } from "@/lib/dto";
import { generateJoinCode } from "@/lib/constants";
import { CourseCreateSchema } from "@/lib/validation/schemas";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(req, "TEACHER");
    const courses = await prisma.course.findMany({
      where: { teacherId: user.id },
      include: { _count: { select: { enrollments: true, assignments: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ courses: courses.map(courseDto) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(req, "TEACHER");
    const body = CourseCreateSchema.parse(await req.json());

    // A chosen code must be free; a generated one is retried on the
    // (astronomically unlikely) collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const course = await prisma.course.create({
          data: {
            name: body.name.trim(),
            description: body.description?.trim() || null,
            joinCode: body.joinCode ?? generateJoinCode(),
            teacherId: user.id,
          },
          include: { _count: { select: { enrollments: true, assignments: true } } },
        });
        return ok({ course: courseDto(course) }, 201);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          if (body.joinCode) throw conflict("That class code is already in use");
          continue;
        }
        throw e;
      }
    }
    throw new Error("Could not allocate a unique join code");
  });
}
