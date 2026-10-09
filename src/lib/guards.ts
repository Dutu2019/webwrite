import type { NextRequest } from "next/server";
import type { Course } from "@prisma/client";
import { prisma } from "./db";
import { bearerFromRequest, verifyToken, type Role } from "./auth";
import { HttpError, forbidden, notFound, unauthorized } from "./http";

export interface AuthUser {
  id: string;
  role: Role;
}

/** Require a valid access token; returns the authenticated user. */
export async function requireUser(req: NextRequest): Promise<AuthUser> {
  const token = bearerFromRequest(req);
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw unauthorized("Invalid or expired token");
  }

  if (payload.type !== "access") {
    throw unauthorized("An access token is required");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw unauthorized("User no longer exists");

  return { id: user.id, role: user.role as Role };
}

/** Require an authenticated user whose role is one of `roles`. */
export async function requireRole(
  req: NextRequest,
  ...roles: Role[]
): Promise<AuthUser> {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) {
    throw forbidden("Your account does not have access to this resource");
  }
  return user;
}

/** Require a teacher who owns the given course. */
export async function requireCourseOwner(
  req: NextRequest,
  courseId: string,
): Promise<{ user: AuthUser; course: Course }> {
  const user = await requireRole(req, "TEACHER");
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");
  if (course.teacherId !== user.id) {
    throw forbidden("You do not own this course");
  }
  return { user, course };
}

/** Assert an active student enrollment in a course, else throw. */
export async function assertEnrolled(
  studentId: string,
  courseId: string,
): Promise<void> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") {
    throw forbidden("You are not enrolled in this course");
  }
}

export { HttpError };
