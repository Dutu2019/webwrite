import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export type Role = "TEACHER" | "STUDENT";

export interface TokenPayload {
  sub: string;
  role: Role;
  type: "access" | "refresh";
}

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? "1h";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL ?? "7d";

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface SignableUser {
  id: string;
  role: string;
}

async function sign(
  user: SignableUser,
  type: "access" | "refresh",
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ role: user.role, type })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export const signAccessToken = (user: SignableUser) =>
  sign(user, "access", ACCESS_TTL);

export const signRefreshToken = (user: SignableUser) =>
  sign(user, "refresh", REFRESH_TTL);

export const accessTokenTtl = ACCESS_TTL;

/** Verify a JWT and return its payload. Throws if invalid/expired. */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret());
  return {
    sub: String(payload.sub),
    role: payload.role as Role,
    type: payload.type as "access" | "refresh",
  };
}

/** Extract a bearer token from the Authorization header, or null. */
export function bearerFromRequest(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}
