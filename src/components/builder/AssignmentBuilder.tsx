"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, hasSession, type Assignment } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import StudentResults from "../professor/StudentResults";
import QuestionCard from "./QuestionCard";
import {
  draftFromQuestion,
  duplicateDraft,
  emptyDraft,
  hasErrors,
  isBlankDraft,
  toQuestionsPayload,
  TYPE_LIST,
  validateDraft,
} from "./questionTypes";
import type { DraftErrors, QuestionDraft, QuestionType, TeacherQuestion } from "./types";

type FullAssignment = Assignment & { questions: TeacherQuestion[] };
type Notice = { kind: "error" | "info"; text: string } | null;

const STATUS_LABEL = { CREATED: "Created", POSTED: "Posted", CLOSED: "Closed" } as const;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

/**
 * Google-Forms-style construction mode for one assignment's questions.
 * Edits stay local until "Save", which replaces the question list via PATCH.
 */
export default function AssignmentBuilder({ assignmentId }: { assignmentId: string }) {
  const user = useSession("TEACHER");
  const [assignment, setAssignment] = useState<FullAssignment | null>(null);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("[]");
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, DraftErrors>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // Drag and drop: the grip arms a card, dragging it shows where it will land
  const [grippedUid, setGrippedUid] = useState<string | null>(null);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ uid: string; after: boolean } | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  // Posted assignments switch between their questions and each student's answers
  const [tab, setTab] = useState<"questions" | "students">("questions");

  const readOnly = Boolean(assignment?.published);
  // Untouched blank questions (like the starter one) don't count as unsaved changes
  const snapshot = useMemo(() => JSON.stringify(toQuestionsPayload(drafts.filter((d) => !isBlankDraft(d)))), [drafts]);
  const dirty = snapshot !== savedSnapshot;
  const savedQuestionCount = assignment?.questions?.length ?? 0;

  // ?tab=students (from the class view's stats) opens the students tab
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "students") setTab("students");
  }, []);

  useEffect(() => {
    // Fetched alongside the session check rather than after it; nothing renders until the user is confirmed
    if (!hasSession()) return;
    api<{ assignment: FullAssignment }>(`/api/assignments/${assignmentId}`)
      .then(({ assignment }) => {
        const loaded = assignment.questions.map(draftFromQuestion);
        setSavedSnapshot(JSON.stringify(toQuestionsPayload(loaded)));
        // A new assignment starts with one short-answer question ready to fill in
        const initial = loaded.length || assignment.published ? loaded : [emptyDraft("SHORT_ANSWER")];
        setAssignment(assignment);
        setDrafts(initial);
        setActiveUid(initial[0]?.uid ?? null);
      })
      .catch((err) =>
        setLoadError(err instanceof ApiError && err.status === 404 ? "Assignment not found." : "Couldn't load the assignment."),
      );
  }, [assignmentId]);

  // Warn before leaving with unsaved questions
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Keep the question being edited in view
  useEffect(() => {
    if (activeUid) cardRefs.current.get(activeUid)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeUid]);

  // ------------------------------------------------------------ Editing

  function update(uid: string, next: QuestionDraft) {
    setDrafts((list) => list.map((d) => (d.uid === uid ? next : d)));
    // Re-check a question live once it has shown errors
    if (errors[uid]) setErrors((all) => ({ ...all, [uid]: validateDraft(next) }));
  }

  function insertAfterActive(draft: QuestionDraft) {
    setDrafts((list) => {
      const at = list.findIndex((d) => d.uid === activeUid);
      const copy = [...list];
      copy.splice(at === -1 ? list.length : at + 1, 0, draft);
      return copy;
    });
    setActiveUid(draft.uid);
  }

  const addQuestion = (type: QuestionType) => insertAfterActive(emptyDraft(type));

  function move(uid: string, delta: -1 | 1) {
    setDrafts((list) => {
      const i = list.findIndex((d) => d.uid === uid);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  // A grip press that never turns into a drag disarms on release
  useEffect(() => {
    if (!grippedUid) return;
    const release = () => setGrippedUid(null);
    window.addEventListener("pointerup", release);
    return () => window.removeEventListener("pointerup", release);
  }, [grippedUid]);

  function endDrag() {
    setGrippedUid(null);
    setDragUid(null);
    setDropTarget(null);
  }

  function dropOn(targetUid: string, after: boolean) {
    if (!dragUid || dragUid === targetUid) return endDrag();
    setDrafts((list) => {
      const moving = list.find((d) => d.uid === dragUid);
      if (!moving) return list;
      const rest = list.filter((d) => d.uid !== dragUid);
      const at = rest.findIndex((d) => d.uid === targetUid);
      rest.splice(at + (after ? 1 : 0), 0, moving);
      return rest;
    });
    endDrag();
  }

  function remove(uid: string) {
    const i = drafts.findIndex((d) => d.uid === uid);
    const rest = drafts.filter((d) => d.uid !== uid);
    setDrafts(rest);
    setActiveUid(rest[Math.min(i, rest.length - 1)]?.uid ?? null);
    setErrors((all) => {
      const next = { ...all };
      delete next[uid];
      return next;
    });
  }

  // ------------------------------------------------------------- Saving

  async function save() {
    setNotice(null);
    const found: Record<string, DraftErrors> = {};
    for (const d of drafts) {
      const e = validateDraft(d);
      if (hasErrors(e)) found[d.uid] = e;
    }
    setErrors(found);
    const firstBad = drafts.find((d) => found[d.uid]);
    if (firstBad) {
      setActiveUid(firstBad.uid);
      setNotice({ kind: "error", text: "Some questions need attention before saving." });
      return;
    }

    setSaving(true);
    try {
      const payload = toQuestionsPayload(drafts);
      const { assignment: saved } = await api<{ assignment: FullAssignment }>(`/api/assignments/${assignmentId}`, "PATCH", {
        questions: payload,
      });
      setAssignment(saved);
      setSavedSnapshot(JSON.stringify(payload));
      setNotice({ kind: "info", text: "Saved." });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function setPublic(published: boolean) {
    setNotice(null);
    try {
      const { assignment: next } = await api<{ assignment: Assignment }>(`/api/assignments/${assignmentId}/publish`, "POST", { published });
      setAssignment((a) => (a ? { ...a, ...next } : a));
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't change visibility." });
    }
  }

  function leave(e: React.MouseEvent) {
    if (dirty && !window.confirm("You have unsaved questions. Leave without saving?")) e.preventDefault();
  }

  // ------------------------------------------------------------- Render

  if (!user) return <main className="dash"><p className="dash-muted">Loading…</p></main>;

  const backHref = assignment ? `/teacher?course=${assignment.courseId}` : "/teacher";

  return (
    <div className="builder">
      <header className="builder-topbar">
        <Link className="link-btn" href={backHref} onClick={leave}>← Back to class</Link>
        <div className="builder-topbar-actions">
          <span className="save-state" aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : notice?.kind === "info" ? notice.text : ""}
          </span>
          {assignment?.status === "CREATED" && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={dirty || savedQuestionCount === 0}
              title={dirty ? "Save your questions first" : savedQuestionCount === 0 ? "Add and save a question first" : undefined}
              onClick={() => setPublic(true)}
            >
              Make public
            </button>
          )}
          {!readOnly && (
            <button type="button" className="btn btn-inline btn-small" disabled={!dirty || saving} onClick={save}>
              Save
            </button>
          )}
        </div>
      </header>

      {loadError && <p className="error builder-load-error">{loadError}</p>}
      {!assignment && !loadError && <p className="dash-muted builder-load-error">Loading…</p>}

      {assignment && (
        <div className="builder-body">
          <div className="builder-column">
            <section className="form-header-card">
              <div className="form-header-top">
                <h1>{assignment.title}</h1>
                <span className={`status-pill status-${assignment.status.toLowerCase()}`}>{STATUS_LABEL[assignment.status]}</span>
              </div>
              {assignment.description && <p className="form-header-desc">{assignment.description}</p>}
              <p className="form-header-meta">
                {assignment.dueAt ? `Due ${dateFormat.format(new Date(assignment.dueAt))}` : "No due date"} ·{" "}
                {drafts.length} {drafts.length === 1 ? "question" : "questions"} ·{" "}
                {drafts.reduce((sum, d) => sum + (Number.isFinite(d.points) ? d.points : 0), 0)} pts
              </p>
            </section>

            {assignment.published && (
              <div className="view-tabs" role="tablist" aria-label="Assignment view">
                <button type="button" role="tab" aria-selected={tab === "questions"} className={`view-tab${tab === "questions" ? " is-active" : ""}`} onClick={() => setTab("questions")}>
                  Questions
                </button>
                <button type="button" role="tab" aria-selected={tab === "students"} className={`view-tab${tab === "students" ? " is-active" : ""}`} onClick={() => setTab("students")}>
                  Students
                </button>
              </div>
            )}

            {assignment.published && tab === "students" ? (
              <StudentResults assignmentId={assignment.id} />
            ) : (
            <>
            {readOnly && (
              <div className="builder-banner" role="note">
                <p>This assignment is public, so its questions are locked. Make it private to edit them; students won&apos;t see it until you make it public again.</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setPublic(false)}>Make private</button>
              </div>
            )}

            {notice?.kind === "error" && <p className="error builder-notice" role="alert">{notice.text}</p>}

            {drafts.length === 0 ? (
              <div className="builder-empty">
                <span className="fleuron" aria-hidden="true">❦</span>
                <p>Add your first question.</p>
                <div className="type-picker">
                  {TYPE_LIST.map((t) => (
                    <button key={t.id} type="button" className="type-option" onClick={() => addQuestion(t.id)} disabled={readOnly}>
                      {t.icon}
                      <span className="type-option-label">{t.label}</span>
                      <span className="type-option-desc">{t.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol className="q-list">
                {drafts.map((d, i) => (
                  <li
                    key={d.uid}
                    className={[
                      d.uid === dragUid && "is-dragging",
                      dropTarget?.uid === d.uid && d.uid !== dragUid && (dropTarget.after ? "drop-after" : "drop-before"),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    draggable={!readOnly && grippedUid === d.uid}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", d.uid);
                      setDragUid(d.uid);
                    }}
                    onDragOver={(e) => {
                      if (!dragUid) return;
                      e.preventDefault();
                      const box = e.currentTarget.getBoundingClientRect();
                      const after = e.clientY > box.top + box.height / 2;
                      if (dropTarget?.uid !== d.uid || dropTarget.after !== after) setDropTarget({ uid: d.uid, after });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dropTarget) dropOn(dropTarget.uid, dropTarget.after);
                    }}
                    onDragEnd={endDrag}
                  >
                    <QuestionCard
                      ref={(el) => {
                        if (el) cardRefs.current.set(d.uid, el);
                        else cardRefs.current.delete(d.uid);
                      }}
                      draft={d}
                      index={i}
                      count={drafts.length}
                      active={d.uid === activeUid}
                      readOnly={readOnly}
                      errors={errors[d.uid] ?? {}}
                      onGrip={() => setGrippedUid(d.uid)}
                      onActivate={() => setActiveUid(d.uid)}
                      onChange={(next) => update(d.uid, next)}
                      onMove={(delta) => move(d.uid, delta)}
                      onDuplicate={() => insertAfterActive(duplicateDraft(d))}
                      onDelete={() => remove(d.uid)}
                    />
                  </li>
                ))}
              </ol>
            )}
            </>
            )}
          </div>

          {!readOnly && drafts.length > 0 && (
            <aside className="builder-rail" aria-label="Add a question">
              {TYPE_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="rail-btn"
                  title={`Add ${t.label.toLowerCase()} question`}
                  aria-label={`Add ${t.label.toLowerCase()} question`}
                  onClick={() => addQuestion(t.id)}
                >
                  <span className="rail-plus" aria-hidden="true">+</span>
                  {t.icon}
                </button>
              ))}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
