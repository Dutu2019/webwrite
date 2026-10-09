"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import MathText, { MathPreview } from "../MathText";
import FeedbackLine from "./FeedbackLine";
import type { Attempt, Feedback, IdeaProgress, StudentQuestion } from "./types";

const CHECK_DELAY_MS = 1000;
const MIN_CHECK_LENGTH = 3;
const ROWS = { SHORT_ANSWER: 2, KEY_IDEAS: 5, ESSAY: 10, MULTIPLE_CHOICE: 0 } as const;

type SubmitResponse = Feedback & { attemptNumber: number; score: number; ideas: IdeaProgress[] };

/** Feedback recovered from a saved attempt. */
function feedbackFromAttempt(a: Attempt): Feedback {
  return {
    ideas: a.criteriaScores.map((c, i) => ({ label: `Idea ${i + 1}`, status: c.status ?? "not_completed" })),
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
  const choice = q.type === "MULTIPLE_CHOICE";
  const last = q.attempts[0];
  const [answer, setAnswer] = useState(last && !choice ? last.answerText : "");
  const [selected, setSelected] = useState<string[]>(last && choice ? last.answerText.split(",").filter(Boolean) : []);
  const [feedback, setFeedback] = useState<Feedback | null>(last ? feedbackFromAttempt(last) : null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(q.attempts.length);
  const [completed, setCompleted] = useState(q.attempts.some((a) => a.isCorrect));
  const [result, setResult] = useState<{ kind: "success" | "info" | "error"; text: string } | null>(null);
  const lastChecked = useRef(last && !choice ? last.answerText : "");
  const lastSubmitted = useRef(last?.answerText ?? "");
  const checkSeq = useRef(0);
  const hintCache = useRef<{ answer: string; hint: string } | null>(null);

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
        setResult({ kind: "success", text: "Correct! This question is complete." });
      } else {
        setResult({ kind: "info", text: `Attempt ${res.attemptNumber} saved. Not complete yet; keep going.` });
      }
    } catch (err) {
      setResult({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't submit. Please try again." });
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  const submit = () => send().catch(() => {}); // the error is already shown on the card

  /** Gemma's hint on the current answer; reused until the answer changes. */
  async function requestHint(): Promise<string> {
    if (hintCache.current?.answer === answerText) return hintCache.current.hint;
    const { hint } = await api<{ hint: string }>(`/api/student/questions/${q.id}/hint`, "POST", { answerText });
    hintCache.current = { answer: answerText, hint };
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
    if (q.multipleAnswers) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else setSelected([id]);
  }

  return (
    <article className={`q-card answer-card${completed ? " is-complete" : ""}`} aria-labelledby={`q-${q.id}`}>
      <header className="answer-head">
        <span className="q-number">{index + 1}</span>
        <div className="answer-prompt" id={`q-${q.id}`}>
          <MathText text={q.prompt} />
        </div>
        <span className="answer-points">
          {q.points} {q.points === 1 ? "pt" : "pts"}
        </span>
      </header>
      {completed && <p className="answer-done">✓ Completed</p>}

      <div className="answer-body">
        {choice ? (
          <fieldset className="choice-list" disabled={closed}>
            <legend className="visually-hidden">Options</legend>
            {q.multipleAnswers && <p className="field-help">Select all that apply.</p>}
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
            <label className="visually-hidden" htmlFor={`a-${q.id}`}>Your answer to question {index + 1}</label>
            <textarea
              id={`a-${q.id}`}
              className="answer-input"
              rows={ROWS[q.type]}
              maxLength={20000}
              placeholder={q.type === "ESSAY" ? "Write your essay…" : "Your answer…"}
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
        <span className="answer-attempts">
          {attempts ? `${attempts} ${attempts === 1 ? "attempt" : "attempts"}` : "Not attempted yet"}
        </span>
        {result && <span className={`answer-result is-${result.kind}`} role="status">{result.text}</span>}
        {!closed && (
          <button type="button" className="btn btn-inline btn-small" disabled={submitting || !answerText} onClick={submit}>
            {submitting ? "Submitting…" : completed ? "Submit again" : "Submit answer"}
          </button>
        )}
      </footer>
    </article>
  );
});

export default AnswerCard;
