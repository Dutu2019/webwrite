"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type Assignment } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import MathText from "../MathText";
import Modal from "../Modal";
import AnswerCard, { type AnswerCardHandle } from "./AnswerCard";
import SubmissionSummary, { type AssignmentResult } from "./SubmissionSummary";
import type { StudentQuestion } from "./types";

interface Detail {
  assignment: Assignment;
  course: { id: string; name: string };
  questions: StudentQuestion[];
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

/** A student answering one assignment, question by question, with Gemma's feedback. */
export default function AssignmentView({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const user = useSession("STUDENT");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [summary, setSummary] = useState<{ result: AssignmentResult; submittedAt: Date } | null>(null);
  const cards = useRef(new Map<string, AnswerCardHandle>());

  /** Send every changed answer, then show the grade in a popup. */
  async function submitAssignment() {
    setSubmitting(true);
    setSubmitError("");
    try {
      for (const card of cards.current.values()) await card.submitPending();
      const result = await api<AssignmentResult>(`/api/student/assignments/${assignmentId}/result`);
      setSummary({ result, submittedAt: new Date() });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Some answers couldn't be submitted. Check the questions marked in red.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    api<Detail>(`/api/student/assignments/${assignmentId}`)
      .then((d) => {
        setDetail(d);
        setDone(new Set(d.questions.filter((q) => q.attempts.some((a) => a.isCorrect)).map((q) => q.id)));
      })
      .catch((err) =>
        setError(err instanceof ApiError && err.status === 404 ? "This assignment isn't available." : "Couldn't load the assignment."),
      );
  }, [user, assignmentId]);

  if (!user) return <main className="dash"><p className="dash-muted">Loading…</p></main>;

  const closed = detail?.assignment.status === "CLOSED";
  const total = detail?.questions.length ?? 0;

  return (
    <div className="builder">
      <header className="builder-topbar">
        <Link className="link-btn" href={detail ? `/student?course=${detail.course.id}` : "/student"}>← Back to class</Link>
        {detail && (
          <span className="save-state">
            {done.size} of {total} {total === 1 ? "question" : "questions"} complete
          </span>
        )}
      </header>

      {error && <p className="error builder-load-error">{error}</p>}
      {!detail && !error && <p className="dash-muted builder-load-error">Loading…</p>}

      {detail && (
        <div className="builder-body student-body">
          <div className="builder-column">
            <section className="form-header-card">
              <div className="form-header-top">
                <div>
                  <p className="form-header-class">{detail.course.name}</p>
                  <h1>{detail.assignment.title}</h1>
                </div>
                <span className={`status-pill status-${detail.assignment.status.toLowerCase()}`}>{closed ? "Closed" : "Open"}</span>
              </div>
              {detail.assignment.description && (
                <p className="form-header-desc"><MathText text={detail.assignment.description} /></p>
              )}
              <p className="form-header-meta">
                {detail.assignment.dueAt ? `Due ${dateFormat.format(new Date(detail.assignment.dueAt))}` : "No due date"} ·{" "}
                {detail.questions.reduce((s, q) => s + q.points, 0)} pts
              </p>
              <div
                className="progress"
                role="progressbar"
                aria-label="Questions complete"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done.size}
              >
                <span className="progress-fill" style={{ width: `${total ? (done.size / total) * 100 : 0}%` }} />
              </div>
              {total > 0 && done.size === total && <p className="assignment-complete">❦ Assignment complete. Well done!</p>}
            </section>

            {closed && (
              <div className="builder-banner" role="note">
                <p>This assignment is closed. You can review your answers, but no new submissions are accepted.</p>
              </div>
            )}

            <ol className="q-list">
              {detail.questions.map((q, i) => (
                <li key={q.id}>
                  <AnswerCard
                    ref={(el) => {
                      if (el) cards.current.set(q.id, el);
                      else cards.current.delete(q.id);
                    }}
                    question={q}
                    index={i}
                    closed={closed}
                    onCompleted={(id) => setDone((prev) => new Set(prev).add(id))}
                  />
                </li>
              ))}
            </ol>

            {!closed && total > 0 && (
              <div className="submit-assignment">
                {submitError && <p className="error" role="alert">{submitError}</p>}
                <p className="field-help">Submits every answer you&apos;ve changed and shows your grade.</p>
                <button type="button" className="btn btn-inline btn-large" disabled={submitting} onClick={submitAssignment}>
                  {submitting ? "Submitting…" : "Submit assignment"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={Boolean(summary)} title="Submitted" onClose={() => setSummary(null)}>
        {summary && (
          <SubmissionSummary
            result={summary.result}
            submittedAt={summary.submittedAt}
            onHome={() => router.push(detail ? `/student?course=${detail.course.id}` : "/student")}
          />
        )}
      </Modal>
    </div>
  );
}
