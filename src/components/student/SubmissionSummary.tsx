"use client";

import MathText from "../MathText";

/** GET /api/student/assignments/:id/result */
export interface AssignmentResult {
  completed: boolean;
  completion: { completedAt: string; score: number | null; attempts: number } | null;
  perQuestion: { questionId: string; prompt: string; points: number; attempts: number; bestScore: number; isCorrect: boolean }[];
  earnedPoints: number;
  maxPoints: number;
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Popup body after "Submit assignment": grade, attempts, submission time, way home. */
export default function SubmissionSummary({
  result,
  submittedAt,
  onHome,
}: {
  result: AssignmentResult;
  submittedAt: Date;
  onHome: () => void;
}) {
  const percent = result.maxPoints ? Math.round((result.earnedPoints / result.maxPoints) * 100) : 0;
  const attempts = result.perQuestion.reduce((sum, q) => sum + q.attempts, 0);
  const correct = result.perQuestion.filter((q) => q.isCorrect).length;

  return (
    <div className="summary">
      <div className="summary-grade">
        <span className="summary-percent">{percent}%</span>
        <span className="summary-points">
          {fmt(result.earnedPoints)} / {fmt(result.maxPoints)} points
        </span>
        <span className={`status-pill ${result.completed ? "status-done" : "status-created"}`}>
          {result.completed ? "Complete" : `${correct} of ${result.perQuestion.length} questions complete`}
        </span>
      </div>

      <dl className="summary-facts">
        <div>
          <dt>Attempts</dt>
          <dd>{attempts}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{timeFormat.format(submittedAt)}</dd>
        </div>
      </dl>

      <table className="summary-table">
        <thead>
          <tr>
            <th scope="col">Question</th>
            <th scope="col">Best score</th>
            <th scope="col">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {result.perQuestion.map((q, i) => (
            <tr key={q.questionId}>
              <td>
                <span className="summary-q">
                  {q.isCorrect ? "✓" : "○"} {i + 1}. <MathText text={q.prompt} inline />
                </span>
              </td>
              <td>{Math.round(q.bestScore)}%</td>
              <td>{q.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="modal-actions">
        <button type="button" className="btn btn-inline" onClick={onHome}>Go to homepage</button>
      </div>
    </div>
  );
}
