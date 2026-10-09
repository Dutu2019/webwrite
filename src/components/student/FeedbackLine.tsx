"use client";

import { useState } from "react";
import { ApiError } from "@/lib/client/api";
import { HINT_MIN_ATTEMPTS } from "@/lib/constants";
import type { Feedback } from "./types";

/** 0–100: included ideas count fully, ideas in progress count half. */
export function closeness(f: Feedback): number | null {
  if (f.isCorrect) return 100;
  if (!f.ideas.length) return null;
  const earned = f.ideas.reduce((sum, i) => sum + (i.status === "included" ? 1 : i.status === "in_progress" ? 0.5 : 0), 0);
  return Math.round((earned / f.ideas.length) * 100);
}

function label(f: Feedback, pct: number | null): string {
  if (f.isCorrect) return "Complete. Submit when you're happy with it.";
  if (f.flaggedIncorrect) return "Something you wrote isn't accurate. Re-read your answer.";
  if (pct === null) return "";
  if (pct < 34) return "Just getting started";
  if (pct < 67) return "On the right track";
  return "Almost there";
}

const STATUS_TEXT = { included: "covered", in_progress: "partly covered", not_completed: "not covered yet" } as const;

type HintState = { kind: "loading" } | { kind: "ready"; text: string } | { kind: "error"; text: string };

/**
 * Gemma's feedback under an answer: how close it is to complete, which ideas are
 * covered, and a lightbulb that asks Gemma for a hint once the student has
 * made HINT_MIN_ATTEMPTS submissions.
 */
export default function FeedbackLine({
  feedback,
  checking,
  canHint,
  attempts,
  showIdeas,
  requestHint,
}: {
  feedback: Feedback | null;
  checking: boolean;
  canHint: boolean;
  attempts: number;
  /** Idea chips; off for multiple choice, which has no ideas. */
  showIdeas: boolean;
  requestHint: () => Promise<string>;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState<HintState | null>(null);
  const pct = feedback ? closeness(feedback) : null;
  const triesLeft = Math.max(0, HINT_MIN_ATTEMPTS - attempts);

  async function toggleHint() {
    if (hintOpen) {
      setHintOpen(false);
      return;
    }
    setHintOpen(true);
    setHint({ kind: "loading" });
    try {
      setHint({ kind: "ready", text: await requestHint() });
    } catch (err) {
      setHint({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't get a hint. Try again." });
    }
  }

  return (
    <div className="feedback">
      <div className="feedback-row">
        {/* The bar stays mounted while Gemma re-checks, so it glides instead of blinking */}
        <div className="feedback-main" aria-live="polite" aria-busy={checking}>
          {!feedback && checking && <span className="feedback-checking">Gemma is reading your answer…</span>}
          {feedback && (
            <>
              {pct !== null && (
                <span
                  className={`closeness${feedback.isCorrect ? " is-complete" : ""}${feedback.flaggedIncorrect ? " is-flagged" : ""}`}
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label="How close your answer is to complete"
                >
                  <span className="closeness-fill" style={{ width: `${pct}%` }} />
                </span>
              )}
              <span className={`feedback-label${feedback.flaggedIncorrect ? " is-flagged" : ""}`}>{label(feedback, pct)}</span>
              <span className={`feedback-pulse${checking ? " is-on" : ""}`} title={checking ? "Gemma is reading your answer" : undefined} />
            </>
          )}
          {!checking && !feedback && <span className="feedback-idle">Start writing; Gemma will tell you how close you are.</span>}
        </div>

        {canHint && (
          <button
            type="button"
            className={`hint-btn${hintOpen ? " is-open" : ""}`}
            aria-expanded={hintOpen}
            disabled={triesLeft > 0}
            title={
              triesLeft > 0
                ? `Hints unlock after ${HINT_MIN_ATTEMPTS} submissions`
                : "Ask Gemma for a hint on your current answer"
            }
            onClick={toggleHint}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4" />
              <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
            </svg>
            {triesLeft > 0 ? `Hint in ${triesLeft} ${triesLeft === 1 ? "try" : "tries"}` : "Hint"}
          </button>
        )}
      </div>

      {showIdeas && feedback && feedback.ideas.length > 0 && !feedback.isCorrect && (
        <ul className="idea-chips" aria-label="Key ideas">
          {feedback.ideas.map((i) => (
            <li key={i.label} className={`idea-chip is-${i.status}`}>
              <span aria-hidden="true">{i.status === "included" ? "✓" : i.status === "in_progress" ? "◐" : "○"}</span> {i.label}
              <span className="visually-hidden">: {STATUS_TEXT[i.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {canHint && hintOpen && hint && (
        <div className={`hint-panel${hint.kind === "error" ? " is-error" : ""}`} role="note" aria-live="polite" aria-busy={hint.kind === "loading"}>
          <p>{hint.kind === "loading" ? "Gemma is looking at your answer…" : hint.text}</p>
        </div>
      )}
    </div>
  );
}
