import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  accessTokenTtl,
  hashPassword,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth";
import { conflict, handle, ok } from "@/lib/http";
import { publicUser } from "@/lib/dto";
import { RegisterSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = RegisterSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("An account with that email already exists");

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        name: body.name.trim(),
        role: body.role,
      },
    });

    const [token, refreshToken] = await Promise.all([
      signAccessToken(user),
      signRefreshToken(user),
    ]);

    return ok({ user: publicUser(user), token, refreshToken, expiresIn: accessTokenTtl }, 201);
  });
}
