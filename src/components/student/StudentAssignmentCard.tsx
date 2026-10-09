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
          {a.description && <span className="assignment-desc"> · {a.description}</span>}
        </p>
      </div>

      <div className="assignment-side">
        {a.completed && (
          <span className="status-pill status-done">
            Completed{a.completion?.score != null && ` · ${Math.round(a.completion.score)}%`}
          </span>
        )}
        <span className={`status-pill status-${a.status.toLowerCase()}`}>{a.status === "CLOSED" ? "Closed" : "Open"}</span>
      </div>
    </article>
  );
}
