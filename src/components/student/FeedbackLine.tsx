"use client";

import { useState } from "react";
import { ApiError } from "@/lib/client/api";
import { HINT_MIN_ATTEMPTS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Feedback } from "./types";

/** 0–100: included ideas count fully, ideas in progress count half. */
export function closeness(f: Feedback): number | null {
  if (f.isCorrect) return 100;
  if (!f.ideas.length) return null;
  const earned = f.ideas.reduce((sum, i) => sum + (i.status === "included" ? 1 : i.status === "in_progress" ? 0.5 : 0), 0);
  return Math.round((earned / f.ideas.length) * 100);
}

const STATUS_ICON = { included: "✓", in_progress: "◐", not_completed: "○" } as const;

// The hint is stored as a kind (not text) while loading or failing, so it follows a language switch
type HintState = { kind: "loading" } | { kind: "ready"; text: string } | { kind: "error"; text: string | null };

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
  const { t } = useI18n();
  const s = t.student.feedback;
  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState<HintState | null>(null);
  const pct = feedback ? closeness(feedback) : null;
  const triesLeft = Math.max(0, HINT_MIN_ATTEMPTS - attempts);
  // Ideas are labelled by position; the server's English labels are never shown
  const ideas = feedback?.ideas.map((idea, i) => ({ ...idea, label: t.common.idea(i + 1) })) ?? [];

  function label(f: Feedback): string {
    if (f.isCorrect) return s.complete;
    if (f.flaggedIncorrect) return s.flagged;
    if (pct === null) return "";
    if (pct < 34) return s.starting;
    if (pct < 67) return s.onTrack;
    return s.almost;
  }

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
      // ApiError messages are already translated; anything else gets the generic text
      setHint({ kind: "error", text: err instanceof ApiError ? err.message : null });
    }
  }

  const hintText =
    hint?.kind === "loading" ? s.hintLoading : hint?.kind === "error" ? (hint.text ?? s.hintError) : hint?.text;

  return (
    <div className="feedback">
      <div className="feedback-row">
        {/* The bar stays mounted while Gemma re-checks, so it glides instead of blinking */}
        <div className="feedback-main" aria-live="polite" aria-busy={checking}>
          {!feedback && checking && <span className="feedback-checking">{s.checking}</span>}
          {feedback && (
            <>
              {pct !== null && (
                <span
                  className={`closeness${feedback.isCorrect ? " is-complete" : ""}${feedback.flaggedIncorrect ? " is-flagged" : ""}`}
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={s.meterLabel}
                >
                  <span className="closeness-fill" style={{ width: `${pct}%` }} />
                </span>
              )}
              <span className={`feedback-label${feedback.flaggedIncorrect ? " is-flagged" : ""}`}>{label(feedback)}</span>
              <span className={`feedback-pulse${checking ? " is-on" : ""}`} title={checking ? s.checking : undefined} />
            </>
          )}
          {!checking && !feedback && <span className="feedback-idle">{s.idle}</span>}
        </div>

        {canHint && (
          <button
            type="button"
            className={`hint-btn${hintOpen ? " is-open" : ""}`}
            aria-expanded={hintOpen}
            disabled={triesLeft > 0}
            title={triesLeft > 0 ? s.hintUnlocksAfter(HINT_MIN_ATTEMPTS) : s.hintAsk}
            onClick={toggleHint}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4" />
              <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
            </svg>
            {triesLeft > 0 ? s.hintIn(triesLeft) : s.hint}
          </button>
        )}
      </div>

      {showIdeas && feedback && ideas.length > 0 && !feedback.isCorrect && (
        <ul className="idea-chips" aria-label={s.keyIdeas}>
          {ideas.map((i) => (
            <li key={i.label} className={`idea-chip is-${i.status}`}>
              <span aria-hidden="true">{STATUS_ICON[i.status]}</span> {i.label}
              <span className="visually-hidden">{t.student.colon("")} {t.common.ideaStatus[i.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {canHint && hintOpen && hint && (
        <div className={`hint-panel${hint.kind === "error" ? " is-error" : ""}`} role="note" aria-live="polite" aria-busy={hint.kind === "loading"}>
          <p>{hintText}</p>
        </div>
      )}
    </div>
  );
}
