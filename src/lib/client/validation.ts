// Client-side checks that mirror the backend's zod schemas (src/lib/validation/schemas.ts).

// Letters from any alphabet (é, ñ, ø, ...); single spaces, hyphens or
// apostrophes allowed only *between* letters: "Jean-Luc O'Neil" is fine,
// "J0hn", "--", "Ann  Lee" and "x" are not.
const NAME_RE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;
const NAME_MIN = 2;
export const NAME_MAX = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const cleanName = (v: string) => v.trim().replace(/\s+/g, " ");

export function isValidName(value: string) {
  const v = cleanName(value);
  return v.length >= NAME_MIN && v.length <= NAME_MAX && NAME_RE.test(v);
}

export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

export const isValidNewPassword = (value: string) =>
  value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
