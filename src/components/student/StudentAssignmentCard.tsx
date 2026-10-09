"use client";

import Link from "next/link";
import type { StudentAssignment } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** One assignment in the student's stack; the name opens it. */
export default function StudentAssignmentCard({ assignment: a }: { assignment: StudentAssignment }) {
  const { t, fmt } = useI18n();
  const s = t.student;
  const count = s.questions(a.questionCount);
  const due = a.dueAt ? s.due(fmt.dateTime(a.dueAt)) : s.noDueDate;

  return (
    <article className="assignment-card student-assignment-card">
      <div className="assignment-main">
        <h3>
          <Link href={`/student/assignments/${a.id}`}>{a.title}</Link>
        </h3>
        {/* One line, cut with an ellipsis; the full text is in the tooltip */}
        <p className="assignment-sub" title={`${count} · ${due}`}>
          <span className="assignment-count">{count}</span>
          <span> · {due}</span>
        </p>
        {a.description && <p className="assignment-desc" title={a.description}>{a.description}</p>}
      </div>

      <div className="assignment-side">
        {a.progress && (
          <span className="assignment-progress" title={s.progress.title}>
            {s.progress.attempts(a.progress.attempts)} ·{" "}
            <strong>{s.progress.best(s.percent(Math.round(a.progress.bestScore)))}</strong>
          </span>
        )}
        {a.completed && <span className="status-pill status-done">{s.completed}</span>}
        <span className={`status-pill status-${a.status.toLowerCase()}`}>
          {a.status === "CLOSED" ? t.common.assignmentStatus.CLOSED : s.open}
        </span>
      </div>
    </article>
  );
}
