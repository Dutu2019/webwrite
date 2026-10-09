"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, type Course } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Popup form: type the code the professor shared to join their class. */
export default function JoinClassForm({
  onJoined,
  onCancel,
}: {
  onJoined: (course: Course) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const s = t.student.join;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code) return setError(s.errors.empty);

    setJoining(true);
    setError("");
    try {
      const { course } = await api<{ course: Course }>("/api/courses/join", "POST", { joinCode: code });
      onJoined(course);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setError(s.errors.notFound);
      else setError(err instanceof ApiError ? `* ${err.message}` : s.errors.generic);
    } finally {
      setJoining(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="join-code">{s.codeLabel}</label>
        <input
          id="join-code"
          className="join-code-input"
          autoFocus
          maxLength={16}
          placeholder={s.codePlaceholder}
          autoComplete="off"
          spellCheck={false}
          value={code}
          aria-invalid={error ? true : undefined}
          aria-describedby="join-code-help"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        />
        <p className="field-help" id="join-code-help">{s.codeHelp}</p>
        <p className="error">{error}</p>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t.common.actions.cancel}</button>
        <button type="submit" className="btn btn-inline" disabled={joining}>
          {joining ? s.joining : s.submit}
        </button>
      </div>
    </form>
  );
}
