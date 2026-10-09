"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, type Course } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

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
  const { t } = useI18n();
  const tf = t.professor.classForm;
  const [name, setName] = useState(course?.name ?? "");
  const [code, setCode] = useState(course?.joinCode ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (!name.trim()) found.name = tf.errors.name;
    if (course && !code) found.code = tf.errors.codeRequired;
    else if (code && !CODE_RE.test(code)) found.code = tf.errors.codeFormat;
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
      if (err instanceof ApiError && err.status === 409) setErrors({ code: tf.errors.codeTaken });
      else setErrors({ form: err instanceof ApiError ? err.message : tf.errors.save });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="class-name">{tf.name}</label>
        <input
          id="class-name"
          autoFocus
          maxLength={200}
          placeholder={tf.namePlaceholder}
          value={name}
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="error">{errors.name}</p>
      </div>

      <div className="field">
        <label htmlFor="class-code">
          {tf.code} {!course && <span className="optional">{t.professor.form.optional}</span>}
        </label>
        <input
          id="class-code"
          maxLength={16}
          placeholder={tf.codePlaceholder}
          value={code}
          aria-invalid={errors.code ? true : undefined}
          aria-describedby="class-code-help"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        />
        <p className="field-help" id="class-code-help">
          {course && code !== course.joinCode ? tf.codeHelpChanged : tf.codeHelp}
        </p>
        <p className="error">{errors.code}</p>
      </div>

      <div className="field">
        <label htmlFor="class-description">
          {t.professor.form.description} <span className="optional">{t.professor.form.optional}</span>
        </label>
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
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t.common.actions.cancel}</button>
        <button type="submit" className="btn btn-inline" disabled={saving}>
          {saving ? t.common.actions.saving : course ? t.professor.form.saveChanges : t.professor.workspace.createClass}
        </button>
      </div>
    </form>
  );
}
