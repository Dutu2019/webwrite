import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { handle, ok, unauthorized } from "@/lib/http";
import { publicUser } from "@/lib/dto";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser(req);
    const user = await prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw unauthorized("User no longer exists");
    return ok({ user: publicUser(user) });
  });
}
