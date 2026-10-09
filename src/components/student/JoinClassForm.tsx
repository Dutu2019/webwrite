"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, type Course } from "@/lib/client/api";

/** Popup form: type the code the professor shared to join their class. */
export default function JoinClassForm({
  onJoined,
  onCancel,
}: {
  onJoined: (course: Course) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code) return setError("* please enter the class code");

    setJoining(true);
    setError("");
    try {
      const { course } = await api<{ course: Course }>("/api/courses/join", "POST", { joinCode: code });
      onJoined(course);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setError("* no class matches this code");
      else setError(err instanceof ApiError ? `* ${err.message}` : "* couldn't join the class, please try again");
    } finally {
      setJoining(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="join-code">Class code</label>
        <input
          id="join-code"
          className="join-code-input"
          autoFocus
          maxLength={16}
          placeholder="e.g. HIST200"
          autoComplete="off"
          spellCheck={false}
          value={code}
          aria-invalid={error ? true : undefined}
          aria-describedby="join-code-help"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        />
        <p className="field-help" id="join-code-help">Your professor shares this code with the class.</p>
        <p className="error">{error}</p>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-inline" disabled={joining}>
          {joining ? "Joining…" : "Join class"}
        </button>
      </div>
    </form>
  );
}
