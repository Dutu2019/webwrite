import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  accessTokenTtl,
  signAccessToken,
  verifyToken,
} from "@/lib/auth";
import { handle, ok, unauthorized } from "@/lib/http";
import { publicUser } from "@/lib/dto";
import { RefreshSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { refreshToken } = RefreshSchema.parse(await req.json());

    let payload;
    try {
      payload = await verifyToken(refreshToken);
    } catch {
      throw unauthorized("Invalid or expired refresh token");
    }
    if (payload.type !== "refresh") {
      throw unauthorized("A refresh token is required");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw unauthorized("User no longer exists");

    const token = await signAccessToken(user);
    return ok({ user: publicUser(user), token, expiresIn: accessTokenTtl });
  });
}
