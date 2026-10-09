import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";

// Re-export the framework-free error types so routes keep a single import site.
export {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
} from "./errors";

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
