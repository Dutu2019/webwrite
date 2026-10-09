"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, hasSession, type Assignment } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LanguageToggle from "../LanguageToggle";
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

/** A student answering one assignment, question by question, with Gemma's feedback. */
export default function AssignmentView({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const user = useSession("STUDENT");
  const { t, fmt } = useI18n();
  const s = t.student.assignment;
  const [detail, setDetail] = useState<Detail | null>(null);
  // Kept as a key so the message follows a language switch
  const [error, setError] = useState<"notAvailable" | "loadError" | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  // `message` is the API's (already translated) error; null falls back to the generic text
  const [submitError, setSubmitError] = useState<{ message: string | null } | null>(null);
  const [summary, setSummary] = useState<{ result: AssignmentResult; submittedAt: Date } | null>(null);
  const cards = useRef(new Map<string, AnswerCardHandle>());

  /** Send every changed answer, then show the grade in a popup. */
  async function submitAssignment() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      for (const card of cards.current.values()) await card.submitPending();
      const result = await api<AssignmentResult>(`/api/student/assignments/${assignmentId}/result`);
      setSummary({ result, submittedAt: new Date() });
    } catch (err) {
      setSubmitError({ message: err instanceof ApiError ? err.message : null });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    // Fetched alongside the session check rather than after it; nothing renders until the user is confirmed
    if (!hasSession()) return;
    api<Detail>(`/api/student/assignments/${assignmentId}`)
      .then((d) => {
        setDetail(d);
        setDone(new Set(d.questions.filter((q) => q.attempts.some((a) => a.isCorrect)).map((q) => q.id)));
      })
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "notAvailable" : "loadError"));
  }, [assignmentId]);

  if (!user) return <main className="dash"><p className="dash-muted">{t.common.status.loading}</p></main>;

  const closed = detail?.assignment.status === "CLOSED";
  const total = detail?.questions.length ?? 0;
  const home = detail ? `/student?course=${detail.course.id}` : "/student";

  return (
    <div className="builder">
      <header className="builder-topbar student-topbar">
        <Link className="link-btn" href={home}>{s.back}</Link>
        <div className="builder-topbar-actions student-topbar-actions">
          {detail && <span className="save-state">{t.student.questionsComplete(done.size, total)}</span>}
          <LanguageToggle />
        </div>
      </header>

      {error && <p className="error builder-load-error">{s[error]}</p>}
      {!detail && !error && <p className="dash-muted builder-load-error">{t.common.status.loading}</p>}

      {detail && (
        <div className="builder-body student-body">
          <div className="builder-column">
            <section className="form-header-card">
              <div className="form-header-top">
                <div>
                  <p className="form-header-class">{detail.course.name}</p>
                  <h1>{detail.assignment.title}</h1>
                </div>
                <span className={`status-pill status-${detail.assignment.status.toLowerCase()}`}>
                  {closed ? t.common.assignmentStatus.CLOSED : t.student.open}
                </span>
              </div>
              {detail.assignment.description && (
                <p className="form-header-desc"><MathText text={detail.assignment.description} /></p>
              )}
              <p className="form-header-meta">
                {detail.assignment.dueAt ? t.student.due(fmt.dateTime(detail.assignment.dueAt)) : t.student.noDueDate} ·{" "}
                {t.student.points(detail.questions.reduce((sum, q) => sum + q.points, 0))}
              </p>
              <div
                className="progress"
                role="progressbar"
                aria-label={s.progressLabel}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done.size}
              >
                <span className="progress-fill" style={{ width: `${total ? (done.size / total) * 100 : 0}%` }} />
              </div>
              {total > 0 && done.size === total && <p className="assignment-complete">{s.allDone}</p>}
            </section>

            {closed && (
              <div className="builder-banner" role="note">
                <p>{s.closedBanner}</p>
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
                {submitError && <p className="error" role="alert">{submitError.message ?? s.submitError}</p>}
                <p className="field-help">{s.submitHelp}</p>
                <button type="button" className="btn btn-inline btn-large" disabled={submitting} onClick={submitAssignment}>
                  {submitting ? s.submitting : s.submit}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={Boolean(summary)} title={s.submittedTitle} onClose={() => setSummary(null)}>
        {summary && (
          <SubmissionSummary result={summary.result} submittedAt={summary.submittedAt} onHome={() => router.push(home)} />
        )}
      </Modal>
    </div>
  );
}
