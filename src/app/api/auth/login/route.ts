import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  accessTokenTtl,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
} from "@/lib/auth";
import { handle, ok, unauthorized } from "@/lib/http";
import { publicUser } from "@/lib/dto";
import { LoginSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = LoginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }

    const [token, refreshToken] = await Promise.all([
      signAccessToken(user),
      signRefreshToken(user),
    ]);

    return ok({ user: publicUser(user), token, refreshToken, expiresIn: accessTokenTtl });
  });
}
