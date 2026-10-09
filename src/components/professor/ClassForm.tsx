"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, type Course } from "@/lib/client/api";

const CODE_RE = /^[A-Z0-9]{3,16}$/;

type Errors = { name?: string; code?: string; form?: string };

/** Create a class, or edit one when `course` is given. */
export default function ClassForm({
  course,
  onSaved,
  onCancel,
}: {
  course?: Course;
  onSaved: (course: Course) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(course);
  const [name, setName] = useState(course?.name ?? "");
  const [code, setCode] = useState(course?.joinCode ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (!name.trim()) found.name = "* please give the class a name";
    if (editing && !code) found.code = "* the class needs a code";
    else if (code && !CODE_RE.test(code)) found.code = "* use 3–16 letters or digits";
    setErrors(found);
    if (found.name || found.code) return;

    setSaving(true);
    try {
      const { course: saved } = course
        ? await api<{ course: Course }>(`/api/courses/${course.id}`, "PATCH", {
            name: name.trim(),
            description: description.trim(),
            ...(code !== course.joinCode ? { joinCode: code } : {}),
          })
        : await api<{ course: Course }>("/api/courses", "POST", {
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(code ? { joinCode: code } : {}),
          });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ code: "* that code is already in use" });
      else setErrors({ form: err instanceof ApiError ? err.message : "Couldn't save the class." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="class-name">Name</label>
        <input
          id="class-name"
          autoFocus
          maxLength={200}
          placeholder="e.g. Modern Political Thought"
          value={name}
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="error">{errors.name}</p>
      </div>

      <div className="field">
        <label htmlFor="class-code">Code {!editing && <span className="optional">optional</span>}</label>
        <input
          id="class-code"
          maxLength={16}
          placeholder="Generated if left blank"
          value={code}
          aria-invalid={errors.code ? true : undefined}
          aria-describedby="class-code-help"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        />
        <p className="field-help" id="class-code-help">
          {editing && code !== course?.joinCode
            ? "Students will need the new code to join; the old one stops working."
            : "Students type this code to join the class."}
        </p>
        <p className="error">{errors.code}</p>
      </div>

      <div className="field">
        <label htmlFor="class-description">Description <span className="optional">optional</span></label>
        <textarea
          id="class-description"
          rows={3}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="error">{errors.form}</p>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-inline" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Create class"}
        </button>
      </div>
    </form>
  );
}
