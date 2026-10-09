"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, type Assignment } from "@/lib/client/api";

type Errors = { title?: string; dueAt?: string; form?: string };

/** "YYYY-MM-DDTHH:mm" in local time, the format <input type="datetime-local"> uses. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Create an assignment in `courseId`, or edit one when `assignment` is given. */
export default function AssignmentForm({
  courseId,
  assignment,
  onSaved,
  onDeleted,
  onCancel,
}: {
  courseId: string;
  assignment?: Assignment;
  onSaved: (assignment: Assignment) => void;
  onDeleted?: (assignment: Assignment) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(assignment);
  const initialDue = assignment?.dueAt ? toLocalInput(new Date(assignment.dueAt)) : "";
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [description, setDescription] = useState(assignment?.description ?? "");
  const [dueAt, setDueAt] = useState(initialDue);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAssignment() {
    if (!assignment) return;
    setDeleting(true);
    try {
      await api(`/api/assignments/${assignment.id}`, "DELETE");
      onDeleted?.(assignment);
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : "Couldn't delete the assignment." });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (!title.trim()) found.title = "* please give the assignment a name";
    const due = dueAt ? new Date(dueAt) : null;
    if (!due || Number.isNaN(due.getTime())) found.dueAt = "* please pick a due date";
    // An unchanged due date may already be past (e.g. editing a closed assignment)
    else if (dueAt !== initialDue && due <= new Date()) found.dueAt = "* the due date must be in the future";
    setErrors(found);
    if (found.title || found.dueAt || !due) return;

    setSaving(true);
    try {
      const fields = { title: title.trim(), dueAt: due.toISOString() };
      const { assignment: saved } = assignment
        ? await api<{ assignment: Assignment & { questions: unknown[] } }>(`/api/assignments/${assignment.id}`, "PATCH", {
            ...fields,
            description: description.trim() || null,
          })
        : await api<{ assignment: Assignment & { questions: unknown[] } }>(`/api/courses/${courseId}/assignments`, "POST", {
            ...fields,
            ...(description.trim() ? { description: description.trim() } : {}),
          });
      onSaved({
        ...saved,
        counts: { questions: saved.questions.length, completions: assignment?.counts?.completions ?? 0 },
      });
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : "Couldn't save the assignment." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="assignment-title">Name</label>
        <input
          id="assignment-title"
          autoFocus
          maxLength={200}
          placeholder="e.g. Essay: Civil Disobedience"
          value={title}
          aria-invalid={errors.title ? true : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="error">{errors.title}</p>
      </div>

      <div className="field">
        <label htmlFor="assignment-description">Description <span className="optional">optional</span></label>
        <textarea
          id="assignment-description"
          rows={3}
          maxLength={10000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="error" />
      </div>

      <div className="field">
        <label htmlFor="assignment-due">Due date</label>
        <input
          id="assignment-due"
          type="datetime-local"
          min={toLocalInput(new Date())}
          value={dueAt}
          aria-invalid={errors.dueAt ? true : undefined}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <p className="error">{errors.dueAt ?? errors.form}</p>
      </div>

      {!editing && (
        <p className="modal-note">New assignments start as <strong>Created</strong>. Students only see them once made public.</p>
      )}

      {editing && confirmDelete && (
        <div className="delete-confirm" role="alert">
          <p>
            Delete <strong>{assignment?.title}</strong>? Its questions and every student answer will be removed. This can&apos;t
            be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Keep it
            </button>
            <button type="button" className="btn btn-inline btn-danger" onClick={deleteAssignment} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      )}

      <div className="modal-actions">
        {editing && !confirmDelete && (
          <button type="button" className="btn btn-ghost btn-delete" onClick={() => setConfirmDelete(true)}>
            Delete assignment
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-inline" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Create assignment"}
        </button>
      </div>
    </form>
  );
}
