import { HttpError } from "./errors";

/**
 * In-memory sliding-window rate limiter. Counts are per server instance: on
 * Vercel each function instance keeps its own, so this caps bursts (a runaway
 * client, a missing debounce) rather than enforcing an exact global quota.
 * A shared store (e.g. Upstash Redis) would make it exact.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    const retryAfterSeconds = Math.ceil((recent[0] + windowMs - now) / 1000);
    throw new HttpError(429, "RATE_LIMITED", "Too many grading requests. Slow down and try again.", {
      retryAfterSeconds,
    });
  }
  recent.push(now);
  hits.set(key, recent);
}
