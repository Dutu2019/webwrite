"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import MathText, { MathPreview } from "../MathText";
import FeedbackLine from "./FeedbackLine";
import type { Attempt, Feedback, IdeaProgress, StudentQuestion } from "./types";

const CHECK_DELAY_MS = 1000;
const MIN_CHECK_LENGTH = 3;
const ROWS = { SHORT_ANSWER: 2, KEY_IDEAS: 5, ESSAY: 10, MULTIPLE_CHOICE: 0 } as const;

type SubmitResponse = Feedback & { attemptNumber: number; score: number; ideas: IdeaProgress[] };

/** Outcome of the last submit. The text is built at render time so it follows the language. */
type Result = { kind: "success" } | { kind: "info"; attempt: number } | { kind: "error"; message: string | null };

/** Feedback recovered from a saved attempt. */
function feedbackFromAttempt(a: Attempt): Feedback {
  return {
    ideas: a.criteriaScores.map((c) => ({ label: c.label, status: c.status ?? "not_completed" })),
    isCorrect: a.isCorrect,
    flaggedIncorrect: false,
    feedback: a.feedback,
  };
}

export interface AnswerCardHandle {
  /** Submit the current answer if it changed since the last submission. Throws if it fails. */
  submitPending: () => Promise<void>;
}

interface Props {
  question: StudentQuestion;
  index: number;
  closed: boolean;
  onCompleted: (questionId: string) => void;
}

/** One question: the prompt, an answer box (or options), Gemma's live feedback, and submit. */
const AnswerCard = forwardRef<AnswerCardHandle, Props>(function AnswerCard({ question: q, index, closed, onCompleted }, ref) {
  const { t, locale } = useI18n();
  const s = t.student.answer;
  const choice = q.type === "MULTIPLE_CHOICE";
  const last = q.attempts[0];
  const [answer, setAnswer] = useState(last && !choice ? last.answerText : "");
  const [selected, setSelected] = useState<string[]>(last && choice ? last.answerText.split(",").filter(Boolean) : []);
  const [feedback, setFeedback] = useState<Feedback | null>(last ? feedbackFromAttempt(last) : null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(q.attempts.length);
  const [completed, setCompleted] = useState(q.attempts.some((a) => a.isCorrect));
  const [result, setResult] = useState<Result | null>(null);
  const lastChecked = useRef(last && !choice ? last.answerText : "");
  const lastSubmitted = useRef(last?.answerText ?? "");
  const checkSeq = useRef(0);
  // Reused until the answer or the language changes
  const hintCache = useRef<{ answer: string; locale: string; hint: string } | null>(null);

  // Live check: grade the draft after the student pauses typing (stores nothing)
  useEffect(() => {
    if (choice || closed) return;
    const text = answer.trim();
    if (text.length < MIN_CHECK_LENGTH || text === lastChecked.current.trim()) return;
    const timer = setTimeout(async () => {
      const seq = ++checkSeq.current;
      setChecking(true);
      try {
        const res = await api<Feedback>(`/api/student/questions/${q.id}/check`, "POST", { answerText: text });
        if (seq !== checkSeq.current) return; // a newer check is under way
        lastChecked.current = text;
        setFeedback(res);
      } catch {
        /* keep the previous feedback; submitting still works */
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answer, choice, closed, q.id]);

  const answerText = choice ? selected.join(",") : answer.trim();

  async function send() {
    setSubmitting(true);
    setResult(null);
    checkSeq.current++; // ignore a check that finishes after the submit
    setChecking(false);
    try {
      const res = await api<SubmitResponse>(`/api/student/questions/${q.id}/submit`, "POST", { answerText });
      lastChecked.current = answer.trim();
      lastSubmitted.current = answerText;
      setFeedback(res);
      setAttempts(res.attemptNumber);
      if (res.isCorrect) {
        setCompleted(true);
        onCompleted(q.id);
        setResult({ kind: "success" });
      } else {
        setResult({ kind: "info", attempt: res.attemptNumber });
      }
    } catch (err) {
      setResult({ kind: "error", message: err instanceof ApiError ? err.message : null });
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  const submit = () => send().catch(() => {}); // the error is already shown on the card

  /** Gemma's hint on the current answer; reused until the answer changes. */
  async function requestHint(): Promise<string> {
    const cached = hintCache.current;
    if (cached?.answer === answerText && cached.locale === locale) return cached.hint;
    const { hint } = await api<{ hint: string }>(`/api/student/questions/${q.id}/hint`, "POST", { answerText, locale });
    hintCache.current = { answer: answerText, locale, hint };
    return hint;
  }

  useImperativeHandle(ref, () => ({
    submitPending: async () => {
      if (closed || !answerText || answerText === lastSubmitted.current) return;
      await send();
    },
  }));

  function toggleOption(id: string) {
    setResult(null);
    if (q.multipleAnswers) setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else setSelected([id]);
  }

  const resultText =
    result?.kind === "success" ? s.correct
    : result?.kind === "info" ? s.attemptSaved(result.attempt)
    : result?.kind === "error" ? (result.message ?? s.submitError)
    : null;

  return (
    <article className={`q-card answer-card${completed ? " is-complete" : ""}`} aria-labelledby={`q-${q.id}`}>
      <header className="answer-head">
        <span className="q-number">{index + 1}</span>
        <div className="answer-prompt" id={`q-${q.id}`}>
          <MathText text={q.prompt} />
        </div>
        <span className="answer-points">{t.student.points(q.points)}</span>
      </header>
      {completed && <p className="answer-done">{s.completed}</p>}

      <div className="answer-body">
        {choice ? (
          <fieldset className="choice-list" disabled={closed}>
            <legend className="visually-hidden">{s.options}</legend>
            {q.multipleAnswers && <p className="field-help">{s.selectAll}</p>}
            {q.options?.map((o) => (
              <label key={o.id} className={`choice${selected.includes(o.id) ? " is-selected" : ""}`}>
                <input
                  type={q.multipleAnswers ? "checkbox" : "radio"}
                  name={`q-${q.id}`}
                  checked={selected.includes(o.id)}
                  onChange={() => toggleOption(o.id)}
                />
                <span><MathText text={o.text} inline /></span>
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <label className="visually-hidden" htmlFor={`a-${q.id}`}>{s.inputLabel(index + 1)}</label>
            <textarea
              id={`a-${q.id}`}
              className="answer-input"
              rows={ROWS[q.type]}
              maxLength={20000}
              placeholder={q.type === "ESSAY" ? s.essayPlaceholder : s.placeholder}
              value={answer}
              readOnly={closed}
              onChange={(e) => {
                setAnswer(e.target.value);
                setResult(null);
              }}
            />
            <MathPreview text={answer} />
          </>
        )}

        {!(choice && !feedback) && (
          <FeedbackLine
            feedback={feedback}
            checking={checking}
            canHint={!closed && !completed}
            attempts={attempts}
            showIdeas={!choice}
            requestHint={requestHint}
          />
        )}
      </div>

      <footer className="answer-footer">
        <span className="answer-attempts">{attempts ? s.attempts(attempts) : s.notAttempted}</span>
        {result && <span className={`answer-result is-${result.kind}`} role="status">{resultText}</span>}
        {!closed && (
          <button type="button" className="btn btn-inline btn-small" disabled={submitting || !answerText} onClick={submit}>
            {submitting ? s.submitting : completed ? s.resubmit : s.submit}
          </button>
        )}
      </footer>
    </article>
  );
});

export default AnswerCard;
