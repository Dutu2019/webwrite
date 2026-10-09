"use client";

import katex from "katex";
import { Fragment, useMemo } from "react";
import { autoMath } from "./autoMath";

/**
 * Text with LaTeX math rendered by KaTeX. Delimiters:
 *   $…$ or \(…\)    inline math
 *   $$…$$ or \[…\]  display math
 * Plain-text math outside delimiters ("x/2", "x^2", "sqrt(2)") is rendered too.
 * Write \$ for a literal dollar sign. Invalid LaTeX shows in red instead of throwing.
 */

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
const ESCAPED_DOLLAR = "\u0000";

export function parseMath(text: string): Segment[] {
  const src = text.replace(/\\\$/g, ESCAPED_DOLLAR);
  const out: Segment[] = [];
  let last = 0;
  for (const m of src.matchAll(MATH_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", value: src.slice(last, start) });
    const [, dbl, bracket, paren, single] = m;
    out.push({ kind: "math", value: (dbl ?? bracket ?? paren ?? single).trim(), display: Boolean(dbl ?? bracket) });
    last = start + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", value: src.slice(last) });
  return out.map((s) => ({ ...s, value: s.value.replaceAll(ESCAPED_DOLLAR, "$") }));
}

/** LaTeX segments, plus plain-text math ("x/2", "x^2", "sqrt(2)") detected inside the text parts. */
export function parseMathWithAuto(text: string): Segment[] {
  return parseMath(text).flatMap((s): Segment[] =>
    s.kind === "math" ? [s] : autoMath(s.value).map((a) => (a.kind === "math" ? { ...a, display: false } : a)),
  );
}

export const hasMath = (text: string) => parseMathWithAuto(text).some((s) => s.kind === "math");

export default function MathText({ text, inline = false }: { text: string; inline?: boolean }) {
  const segments = useMemo(() => parseMathWithAuto(text), [text]);
  return (
    <>
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <Fragment key={i}>{s.value}</Fragment>
        ) : (
          <span
            key={i}
            className={s.display && !inline ? "math-display" : "math-inline"}
            // KaTeX escapes its input and `trust` is off, so this markup is safe
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(s.value, {
                displayMode: s.display && !inline,
                throwOnError: false,
                errorColor: "#b3261e",
              }),
            }}
          />
        ),
      )}
    </>
  );
}

/** Rendered preview under an input, shown only when the text contains math. */
export function MathPreview({ text }: { text: string }) {
  if (!hasMath(text)) return null;
  return (
    <div className="math-preview" aria-label="Rendered preview">
      <span className="math-preview-label">Preview</span>
      <div className="math-preview-body">
        <MathText text={text} />
      </div>
    </div>
  );
}
