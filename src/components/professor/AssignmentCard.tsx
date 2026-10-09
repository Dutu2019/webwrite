"use client";

import Link from "next/link";
import { forwardRef, useState } from "react";
import { api, ApiError, type Assignment } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import EditButton from "./EditButton";

/** Opened / completed counts out of the class's enrolled students. */
function StudentStats({ stats }: { stats: NonNullable<Assignment["stats"]> }) {
  const { t } = useI18n();
  const { students, opened, completed } = stats;
  return (
    <span className="assignment-stats">
      <span title={t.professor.card.openedTitle(opened, students)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="visually-hidden">{t.professor.card.openedBy}</span>
        {opened}/{students}
      </span>
      <span title={t.professor.card.completedTitle(completed, students)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
        <span className="visually-hidden">{t.professor.card.completedBy}</span>
        {completed}/{students}
      </span>
    </span>
  );
}

/** One compact row in a class's assignment stack. The name opens its questions page. */
const AssignmentCard = forwardRef<
  HTMLElement,
  {
    assignment: Assignment;
    selected: boolean;
    onChange: (a: Assignment) => void;
    onEdit: () => void;
  }
>(function AssignmentCard({ assignment: a, selected, onChange, onEdit }, ref) {
  const { t, fmt } = useI18n();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const questions = t.professor.card.questions(a.counts?.questions ?? 0);
  const due = a.dueAt ? t.professor.card.due(fmt.dateTime(a.dueAt)) : t.professor.card.noDue;

  async function makePublic() {
    setBusy(true);
    setError("");
    try {
      const { assignment } = await api<{ assignment: Assignment }>(`/api/assignments/${a.id}/publish`, "POST", { published: true });
      onChange({ ...assignment, counts: a.counts });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.professor.card.publishError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article ref={ref} className={`assignment-card${selected ? " is-selected" : ""}`}>
      <div className="assignment-main">
        <h3>
          <Link href={`/teacher/assignments/${a.id}`}>{a.title}</Link>
        </h3>
        {/* A single truncated line; the tooltip keeps the full text */}
        <p className="assignment-sub" title={`${questions} · ${due}`}>
          <span className="assignment-count">{questions}</span>
          <span> · {due}</span>
        </p>
        {a.description && <p className="assignment-desc" title={a.description}>{a.description}</p>}
        {error && <p className="error assignment-error">{error}</p>}
      </div>

      <div className="assignment-side">
        {a.stats && a.status !== "CREATED" && (
          <Link className="assignment-stats-link" href={`/teacher/assignments/${a.id}?tab=students`} title={t.professor.card.seeResults}>
            <StudentStats stats={a.stats} />
          </Link>
        )}
        {a.status === "CREATED" && (
          <button type="button" className="btn btn-inline btn-small" onClick={makePublic} disabled={busy}>
            {busy ? t.professor.card.publishing : t.professor.card.publish}
          </button>
        )}
        <span className={`status-pill status-${a.status.toLowerCase()}`}>{t.common.assignmentStatus[a.status]}</span>
        <EditButton label={t.professor.card.edit(a.title)} onClick={onEdit} />
      </div>
    </article>
  );
});

export default AssignmentCard;
