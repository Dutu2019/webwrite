import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { handle, ok } from "@/lib/http";
import { publicUser } from "@/lib/dto";
import { StudentSearchSchema } from "@/lib/validation/schemas";

/**
 * Teacher lookup so a teacher can invite a student by typing part of their
 * name or email. Returns a small, safe list of matching students.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(req, "TEACHER");
    const q = StudentSearchSchema.parse({
      q: req.nextUrl.searchParams.get("q") ?? "",
    });

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        OR: [
          { name: { contains: q.q } },
          { email: { contains: q.q.toLowerCase() } },
        ],
      },
      orderBy: { name: "asc" },
      take: 20,
    });

    return ok({ students: students.map(publicUser) });
  });
}
