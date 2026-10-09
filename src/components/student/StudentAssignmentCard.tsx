import Link from "next/link";
import type { StudentAssignment } from "@/lib/client/api";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** One assignment in the student's stack; the name opens it. */
export default function StudentAssignmentCard({ assignment: a }: { assignment: StudentAssignment }) {
  return (
    <article className="assignment-card">
      <div className="assignment-main">
        <h3>
          <Link href={`/student/assignments/${a.id}`}>{a.title}</Link>
        </h3>
        <p className="assignment-sub">
          <span className="assignment-count">{a.questionCount} {a.questionCount === 1 ? "question" : "questions"}</span>
          <span> · {a.dueAt ? `Due ${dateFormat.format(new Date(a.dueAt))}` : "No due date"}</span>
        </p>
        {a.description && <p className="assignment-desc" title={a.description}>{a.description}</p>}
      </div>

      <div className="assignment-side">
        {a.progress && (
          <span className="assignment-progress" title="Submissions so far, and your best score">
            {a.progress.attempts} {a.progress.attempts === 1 ? "attempt" : "attempts"} ·{" "}
            <strong>Best {Math.round(a.progress.bestScore)}%</strong>
          </span>
        )}
        {a.completed && <span className="status-pill status-done">Completed</span>}
        <span className={`status-pill status-${a.status.toLowerCase()}`}>{a.status === "CLOSED" ? "Closed" : "Open"}</span>
      </div>
    </article>
  );
}
