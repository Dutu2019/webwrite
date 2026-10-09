"use client";

import { useState } from "react";
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

/**
 * Gemma's feedback under an answer: how close it is to complete, which ideas are
 * covered, and a lightbulb that reveals a hint on demand.
 */
export default function FeedbackLine({
  feedback,
  checking,
  canHint,
}: {
  feedback: Feedback | null;
  checking: boolean;
  canHint: boolean;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const pct = feedback ? closeness(feedback) : null;
  const hints = feedback?.ideas.filter((i) => i.hint && i.status !== "included") ?? [];

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
            title="Show a hint"
            onClick={() => setHintOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4" />
              <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
            </svg>
            Hint
          </button>
        )}
      </div>

      {feedback && feedback.ideas.length > 0 && !feedback.isCorrect && (
        <ul className="idea-chips" aria-label="Key ideas">
          {feedback.ideas.map((i) => (
            <li key={i.label} className={`idea-chip is-${i.status}`}>
              <span aria-hidden="true">{i.status === "included" ? "✓" : i.status === "in_progress" ? "◐" : "○"}</span> {i.label}
              <span className="visually-hidden">: {STATUS_TEXT[i.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {canHint && hintOpen && (
        <div className="hint-panel" role="note">
          {hints.length > 0 ? (
            <ul>
              {hints.map((i) => (
                <li key={i.label}><strong>{i.label}:</strong> {i.hint}</li>
              ))}
            </ul>
          ) : feedback?.feedback && !feedback.isCorrect ? (
            <p>{feedback.feedback}</p>
          ) : feedback?.isCorrect ? (
            <p>You&apos;ve covered everything. No hint needed!</p>
          ) : (
            <p>Write a first attempt, then open the hint again; it adapts to what you&apos;ve written.</p>
          )}
        </div>
      )}
    </div>
  );
}
