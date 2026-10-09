import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** An error carrying an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") =>
  new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") =>
  new HttpError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

/**
 * Wrap a route handler body. Converts HttpError / ZodError into the standard
 * error envelope and anything else into a 500 without leaking internals.
 */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) {
      return fail(e.status, e.code, e.message, e.details);
    }
    if (e instanceof ZodError) {
      return fail(400, "VALIDATION_ERROR", "Invalid request", e.flatten());
    }
    console.error("[api] unhandled error:", e);
    return fail(500, "INTERNAL_ERROR", "Something went wrong");
  }
}
