"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import MathText from "../MathText";

/** GET /api/student/assignments/:id/result */
export interface AssignmentResult {
  completed: boolean;
  completion: { completedAt: string; score: number | null; attempts: number } | null;
  perQuestion: { questionId: string; prompt: string; points: number; attempts: number; bestScore: number; isCorrect: boolean }[];
  earnedPoints: number;
  maxPoints: number;
}

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
  const { t, fmt } = useI18n();
  const s = t.student.summary;
  const points = (n: number) => fmt.number(Math.round(n * 10) / 10); // at most one decimal
  const percent = result.maxPoints ? Math.round((result.earnedPoints / result.maxPoints) * 100) : 0;
  const attempts = result.perQuestion.reduce((sum, q) => sum + q.attempts, 0);
  const correct = result.perQuestion.filter((q) => q.isCorrect).length;

  return (
    <div className="summary">
      <div className="summary-grade">
        <span className="summary-percent">{t.student.percent(percent)}</span>
        <span className="summary-points">{s.pointsOf(points(result.earnedPoints), points(result.maxPoints))}</span>
        <span className={`status-pill ${result.completed ? "status-done" : "status-created"}`}>
          {result.completed ? t.student.completed : t.student.questionsComplete(correct, result.perQuestion.length)}
        </span>
      </div>

      <dl className="summary-facts">
        <div>
          <dt>{s.attempts}</dt>
          <dd>{fmt.number(attempts)}</dd>
        </div>
        <div>
          <dt>{s.submitted}</dt>
          <dd>{fmt.dateTime(submittedAt)}</dd>
        </div>
      </dl>

      <table className="summary-table">
        <thead>
          <tr>
            <th scope="col">{s.question}</th>
            <th scope="col">{s.bestScore}</th>
            <th scope="col">{s.attempts}</th>
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
              <td>{t.student.percent(Math.round(q.bestScore))}</td>
              <td>{q.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="modal-actions">
        <button type="button" className="btn btn-inline" onClick={onHome}>{s.goHome}</button>
      </div>
    </div>
  );
}
