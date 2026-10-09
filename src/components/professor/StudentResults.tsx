"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type User } from "@/lib/client/api";
import { QUESTION_TYPE_DEFS } from "../builder/questionTypes";
import type { TeacherQuestion } from "../builder/types";
import MathText from "../MathText";

interface CriterionScore {
  key: string;
  score: number;
  weight: number;
  status?: "not_completed" | "in_progress" | "included" | null;
}

interface Submission {
  id: string;
  questionId: string;
  attemptNumber: number;
  answerText: string;
  score: number | null;
  criteriaScores: CriterionScore[];
  feedback: string | null;
  isCorrect: boolean;
  createdAt: string;
}

interface StudentRow {
  student: User;
  opened: boolean;
  attempts: number;
  bestScore: number;
  completion: { completedAt: string; score: number | null; attempts: number } | null;
  submissions: Submission[];
}

interface Report {
  questions: TeacherQuestion[];
  students: StudentRow[];
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

const STATUS_ICON = { included: "✓", in_progress: "◐", not_completed: "○" } as const;
const STATUS_TEXT = { included: "Covered", in_progress: "Partly covered", not_completed: "Not covered" } as const;

/** Where a student is on the assignment, for the status pill. */
function progressOf(row: StudentRow): { label: string; className: string } {
  if (row.completion) return { label: "Completed", className: "status-done" };
  if (row.attempts > 0) return { label: "In progress", className: "status-posted" };
  if (row.opened) return { label: "Opened", className: "status-created" };
  return { label: "Not started", className: "status-created" };
}

/**
 * The teacher's per-student view of one posted assignment: a stack of student
 * cards (like the class's assignment stack), and for the chosen student every
 * attempt on every question, read against the answer key.
 */
export default function StudentResults({ assignmentId }: { assignmentId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api<Report>(`/api/assignments/${assignmentId}/submissions`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load student results."));
  }, [assignmentId]);

  // Most active first, then by name
  const students = useMemo(
    () =>
      [...(report?.students ?? [])].sort(
        (a, b) => b.bestScore - a.bestScore || b.attempts - a.attempts || a.student.name.localeCompare(b.student.name),
      ),
    [report],
  );
  const selected = students.find((s) => s.student.id === selectedId) ?? null;

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="dash-muted">Loading student results…</p>;

  if (selected) {
    return <StudentAnswers row={selected} questions={report.questions} onBack={() => setSelectedId(null)} />;
  }

  if (students.length === 0) {
    return (
      <div className="builder-empty">
        <span className="fleuron" aria-hidden="true">❦</span>
        <p>No students have joined this class yet. Share the join code from the class page.</p>
      </div>
    );
  }

  const completed = students.filter((s) => s.completion).length;
  return (
    <section aria-label="Students">
      <p className="results-summary">
        {completed} of {students.length} {students.length === 1 ? "student" : "students"} completed
      </p>
      <div className="assignment-stack">
        {students.map((row) => {
          const status = progressOf(row);
          return (
            <article key={row.student.id} className="assignment-card student-card">
              <div className="assignment-main">
                <h3>
                  <button type="button" className="student-card-name" onClick={() => setSelectedId(row.student.id)}>
                    {row.student.name}
                  </button>
                </h3>
                <p className="assignment-sub">{row.student.email}</p>
              </div>
              <div className="assignment-side">
                {row.attempts > 0 && (
                  <span className="assignment-progress">
                    {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"} ·{" "}
                    <strong>Best {Math.round(row.bestScore)}%</strong>
                  </span>
                )}
                <span className={`status-pill ${status.className}`}>{status.label}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Every question with the student's attempts on it, newest first. */
function StudentAnswers({ row, questions, onBack }: { row: StudentRow; questions: TeacherQuestion[]; onBack: () => void }) {
  const status = progressOf(row);
  return (
    <section className="student-answers" aria-label={`${row.student.name}'s answers`}>
      <button type="button" className="link-btn" onClick={onBack}>← All students</button>
      <header className="form-header-card">
        <div className="form-header-top">
          <h2>{row.student.name}</h2>
          <span className={`status-pill ${status.className}`}>{status.label}</span>
        </div>
        <p className="form-header-meta">
          {row.student.email} · {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"} · Best {Math.round(row.bestScore)}%
        </p>
      </header>

      <ol className="q-list">
        {questions.map((q, i) => {
          const attempts = row.submissions.filter((s) => s.questionId === q.id).sort((a, b) => b.attemptNumber - a.attemptNumber);
          const best = attempts.length ? Math.max(...attempts.map((a) => a.score ?? 0)) : null;
          const done = attempts.some((a) => a.isCorrect);
          return (
            <li key={q.id}>
              <article className={`q-card answer-card${done ? " is-complete" : ""}`}>
                <header className="answer-head">
                  <span className="q-number">{i + 1}</span>
                  <div className="answer-prompt">
                    <MathText text={q.prompt} />
                    <span className="result-type">{QUESTION_TYPE_DEFS[q.type].label}</span>
                  </div>
                  <span className="answer-points">
                    {best === null ? "—" : `Best ${Math.round(best)}%`} · {q.points} {q.points === 1 ? "pt" : "pts"}
                  </span>
                </header>

                <div className="answer-body">
                  {attempts.length === 0 ? (
                    <p className="dash-muted">Not attempted yet.</p>
                  ) : (
                    <ol className="attempt-list">
                      {attempts.map((a) => (
                        <AttemptItem key={a.id} attempt={a} question={q} />
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AttemptItem({ attempt: a, question: q }: { attempt: Submission; question: TeacherQuestion }) {
  const picked = q.type === "MULTIPLE_CHOICE" ? new Set(a.answerText.split(",").filter(Boolean)) : null;
  return (
    <li className={`attempt${a.isCorrect ? " is-correct" : ""}`}>
      <p className="attempt-meta">
        <strong>Attempt {a.attemptNumber}</strong> · {a.score === null ? "Not graded" : `${Math.round(a.score)}%`}
        {a.isCorrect && <span className="attempt-correct"> · ✓ Complete</span>} ·{" "}
        <time dateTime={a.createdAt}>{dateFormat.format(new Date(a.createdAt))}</time>
      </p>

      {picked ? (
        <ul className="attempt-choices">
          {q.options?.map((o) => (
            <li key={o.id} className={`${picked.has(o.id) ? "is-picked" : ""}${o.correct ? " is-answer" : ""}`}>
              <span aria-hidden="true">{picked.has(o.id) ? "●" : "○"}</span> <MathText text={o.text} inline />
              {o.correct && <span className="attempt-key"> (correct)</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="attempt-answer"><MathText text={a.answerText} /></div>
      )}

      {a.criteriaScores.length > 0 && (
        <ul className="idea-chips attempt-ideas" aria-label="Criteria">
          {a.criteriaScores.map((c, i) => {
            const status = c.status ?? "not_completed";
            const description = q.criteria?.[i]?.description || c.key;
            return (
              <li key={c.key} className={`idea-chip is-${status}`} title={`${STATUS_TEXT[status]}: ${description}`}>
                <span aria-hidden="true">{STATUS_ICON[status]}</span> {description}
              </li>
            );
          })}
        </ul>
      )}

      {a.feedback && !a.isCorrect && <p className="attempt-feedback">Feedback shown: {a.feedback}</p>}
    </li>
  );
}
