/**
 * Detects math typed as plain text ("x/2", "(a+b)/c", "x^2", "sqrt(2)") and
 * converts it to LaTeX for display. The stored text never changes.
 *
 * Deliberately conservative for prose: operands must be numbers, single
 * letters (optionally with a coefficient, "2x") or short (...) groups, and a
 * match can't touch other letters, digits, slashes, dots or colons. So
 * "and/or", "10/09/2026", "http://a/b" and "3.5/x.y" stay as text.
 */

export type AutoSegment = { kind: "text"; value: string } | { kind: "math"; value: string };

const GROUP = String.raw`\([^()\n]{1,60}\)`;
const SQRT = String.raw`sqrt${GROUP}`;
const ATOM = String.raw`(?:${SQRT}|${GROUP}|\d+(?:\.\d+)?[a-zA-Z]?|[a-zA-Z])`;
const POWER = String.raw`${ATOM}(?:\^${ATOM})?`;
const EXPR = String.raw`${POWER}\/${POWER}|${ATOM}\^${ATOM}|${SQRT}`;

// Not glued to words, numbers, paths, URLs, decimals or LaTeX commands
const AUTO_RE = new RegExp(String.raw`(?<![\w\/.:\\$^])(?:${EXPR})(?![\w\/^(]|\.\d)`, "g");

const stripParens = (s: string) => (/^\(.*\)$/.test(s) ? s.slice(1, -1) : s);

/** Operators inside an expression: *, <=, >=, != and nested sqrt(...). */
function inner(s: string): string {
  return s
    .replace(/sqrt\(([^()]*)\)/g, (_, x) => String.raw`\sqrt{${inner(x)}}`)
    .replace(/<=/g, String.raw`\le `)
    .replace(/>=/g, String.raw`\ge `)
    .replace(/!=/g, String.raw`\ne `)
    .replace(/\*/g, String.raw`\cdot `);
}

function atomToLatex(atom: string): string {
  const sqrt = atom.match(/^sqrt\((.*)\)$/);
  if (sqrt) return String.raw`\sqrt{${inner(sqrt[1])}}`;
  return inner(atom);
}

function powerToLatex(power: string): string {
  // Split on the top-level ^ (outside parentheses)
  let depth = 0;
  for (let i = 0; i < power.length; i++) {
    const ch = power[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "^" && depth === 0) {
      return `${atomToLatex(power.slice(0, i))}^{${atomToLatex(stripParens(power.slice(i + 1)))}}`;
    }
  }
  return atomToLatex(power);
}

/** LaTeX for one detected expression, e.g. "(a+b)/2" -> "\frac{a+b}{2}". */
export function exprToLatex(expr: string): string {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "/" && depth === 0) {
      const num = expr.slice(0, i);
      const den = expr.slice(i + 1);
      const side = (s: string) => (s.includes("^") ? powerToLatex(s) : atomToLatex(stripParens(s)));
      return String.raw`\frac{${side(num)}}{${side(den)}}`;
    }
  }
  return powerToLatex(expr);
}

/** Split plain text into text and auto-detected math (as LaTeX). */
export function autoMath(text: string): AutoSegment[] {
  const out: AutoSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(AUTO_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", value: text.slice(last, start) });
    out.push({ kind: "math", value: exprToLatex(m[0]) });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}
