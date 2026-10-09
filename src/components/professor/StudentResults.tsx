"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type User } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
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

const STATUS_ICON = { included: "✓", in_progress: "◐", not_completed: "○" } as const;

type Progress = "completed" | "inProgress" | "opened" | "notStarted";
const PROGRESS_CLASS: Record<Progress, string> = {
  completed: "status-done",
  inProgress: "status-posted",
  opened: "status-created",
  notStarted: "status-created",
};

/** Where a student is on the assignment, for the status pill. */
function progressOf(row: StudentRow): Progress {
  if (row.completion) return "completed";
  if (row.attempts > 0) return "inProgress";
  if (row.opened) return "opened";
  return "notStarted";
}

function StatusPill({ row }: { row: StudentRow }) {
  const { t } = useI18n();
  const progress = progressOf(row);
  return <span className={`status-pill ${PROGRESS_CLASS[progress]}`}>{t.professor.results.status[progress]}</span>;
}

/**
 * The teacher's per-student view of one posted assignment: a stack of student
 * cards (like the class's assignment stack), and for the chosen student every
 * attempt on every question, read against the answer key.
 */
export default function StudentResults({ assignmentId }: { assignmentId: string }) {
  const { t, locale } = useI18n();
  const r = t.professor.results;
  const [report, setReport] = useState<Report | null>(null);
  // null = no error; "" = generic error (text follows the language); otherwise a translated API message
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api<Report>(`/api/assignments/${assignmentId}/submissions`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : ""));
  }, [assignmentId]);

  // Most active first, then by name
  const students = useMemo(
    () =>
      [...(report?.students ?? [])].sort(
        (a, b) =>
          b.bestScore - a.bestScore || b.attempts - a.attempts || a.student.name.localeCompare(b.student.name, locale),
      ),
    [report, locale],
  );
  const selected = students.find((s) => s.student.id === selectedId) ?? null;

  if (error !== null) return <p className="error">{error || r.loadError}</p>;
  if (!report) return <p className="dash-muted">{r.loading}</p>;

  if (selected) {
    return <StudentAnswers row={selected} questions={report.questions} onBack={() => setSelectedId(null)} />;
  }

  if (students.length === 0) {
    return (
      <div className="builder-empty">
        <span className="fleuron" aria-hidden="true">❦</span>
        <p>{r.noStudents}</p>
      </div>
    );
  }

  const completed = students.filter((s) => s.completion).length;
  return (
    <section aria-label={r.sectionLabel}>
      <p className="results-summary">{r.summary(completed, students.length)}</p>
      <div className="assignment-stack">
        {students.map((row) => (
          <article key={row.student.id} className="assignment-card student-card">
            <div className="assignment-main">
              <h3>
                <button type="button" className="student-card-name" onClick={() => setSelectedId(row.student.id)}>
                  {row.student.name}
                </button>
              </h3>
              <p className="assignment-sub" title={row.student.email}>{row.student.email}</p>
            </div>
            <div className="assignment-side">
              {row.attempts > 0 && (
                <span className="assignment-progress">
                  {r.attempts(row.attempts)} · <strong>{r.best(t.common.percent(Math.round(row.bestScore)))}</strong>
                </span>
              )}
              <StatusPill row={row} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Every question with the student's attempts on it, newest first. */
function StudentAnswers({ row, questions, onBack }: { row: StudentRow; questions: TeacherQuestion[]; onBack: () => void }) {
  const { t } = useI18n();
  const r = t.professor.results;
  const pct = (n: number) => t.common.percent(Math.round(n));
  return (
    <section className="student-answers" aria-label={r.answersOf(row.student.name)}>
      <button type="button" className="link-btn" onClick={onBack}>{r.allStudents}</button>
      <header className="form-header-card">
        <div className="form-header-top">
          <h2>{row.student.name}</h2>
          <StatusPill row={row} />
        </div>
        <p className="form-header-meta">
          {row.student.email} · {r.attempts(row.attempts)} · {r.best(pct(row.bestScore))}
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
                    <span className="result-type">{t.builder.types[q.type].label}</span>
                  </div>
                  <span className="answer-points">
                    {best === null ? "—" : r.best(pct(best))} · {r.points(q.points)}
                  </span>
                </header>

                <div className="answer-body">
                  {attempts.length === 0 ? (
                    <p className="dash-muted">{r.notAttempted}</p>
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
  const { t, fmt, server } = useI18n();
  const r = t.professor.results;
  const picked = q.type === "MULTIPLE_CHOICE" ? new Set(a.answerText.split(",").filter(Boolean)) : null;
  return (
    <li className={`attempt${a.isCorrect ? " is-correct" : ""}`}>
      <p className="attempt-meta">
        <strong>{r.attempt(a.attemptNumber)}</strong> · {a.score === null ? r.notGraded : t.common.percent(Math.round(a.score))}
        {a.isCorrect && <span className="attempt-correct"> · {r.complete}</span>} ·{" "}
        <time dateTime={a.createdAt}>{fmt.dateTime(a.createdAt)}</time>
      </p>

      {picked ? (
        <ul className="attempt-choices">
          {q.options?.map((o) => (
            <li key={o.id} className={`${picked.has(o.id) ? "is-picked" : ""}${o.correct ? " is-answer" : ""}`}>
              <span aria-hidden="true">{picked.has(o.id) ? "●" : "○"}</span> <MathText text={o.text} inline />
              {o.correct && <span className="attempt-key"> {r.correctKey}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="attempt-answer"><MathText text={a.answerText} /></div>
      )}

      {a.criteriaScores.length > 0 && (
        <ul className="idea-chips attempt-ideas" aria-label={r.criteria}>
          {a.criteriaScores.map((c, i) => {
            const status = c.status ?? "not_completed";
            const description = q.criteria?.[i]?.description || c.key;
            return (
              <li key={c.key} className={`idea-chip is-${status}`} title={t.student.colon(t.common.ideaStatus[status]) + " " + description}>
                <span aria-hidden="true">{STATUS_ICON[status]}</span> {description}
              </li>
            );
          })}
        </ul>
      )}

      {a.feedback && !a.isCorrect && <p className="attempt-feedback">{r.feedbackShown(server(a.feedback) ?? "")}</p>}
    </li>
  );
}
