/** Opaque, unambiguous alphabet (no O/0, I/1). */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

/** Fallback criteria when a question doesn't define its own. */
export const DEFAULT_CRITERIA = [
  {
    key: "completeness",
    weight: 0.6,
    description: "How fully the answer addresses the prompt.",
  },
  {
    key: "elaboration",
    weight: 0.4,
    description: "How developed and well-reasoned the answer is.",
  },
] as const;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
