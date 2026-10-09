"use client";

import Link from "next/link";
import { forwardRef, useState } from "react";
import { api, ApiError, type Assignment } from "@/lib/client/api";
import EditButton from "./EditButton";

const STATUS_LABEL = { CREATED: "Created", POSTED: "Posted", CLOSED: "Closed" } as const;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const questions = a.counts?.questions ?? 0;

  async function makePublic() {
    setBusy(true);
    setError("");
    try {
      const { assignment } = await api<{ assignment: Assignment }>(`/api/assignments/${a.id}/publish`, "POST", { published: true });
      onChange({ ...assignment, counts: a.counts });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't make the assignment public.");
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
        <p className="assignment-sub">
          <span className="assignment-count">{questions} {questions === 1 ? "question" : "questions"}</span>
          <span> · {a.dueAt ? `Due ${dateFormat.format(new Date(a.dueAt))}` : "No due date"}</span>
          {a.description && <span className="assignment-desc"> · {a.description}</span>}
        </p>
        {error && <p className="error assignment-error">{error}</p>}
      </div>

      <div className="assignment-side">
        {a.status === "CREATED" && (
          <button type="button" className="btn btn-inline btn-small" onClick={makePublic} disabled={busy}>
            {busy ? "Publishing…" : "Make public"}
          </button>
        )}
        <span className={`status-pill status-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
        <EditButton label={`Edit ${a.title}`} onClick={onEdit} />
      </div>
    </article>
  );
});

export default AssignmentCard;
