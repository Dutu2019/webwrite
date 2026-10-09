"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { api, ApiError, hasSession, type Assignment } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LanguageToggle from "../LanguageToggle";
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
// Kinds rather than text, so messages follow a language switch (API errors arrive translated)
type Notice = { kind: "saved" } | { kind: "needsFixing" } | { kind: "error"; text: string } | null;
type LoadError = "" | "notFound" | "loadFailed";

const NO_ERRORS: DraftErrors = {};

/**
 * Google-Forms-style construction mode for one assignment's questions.
 * Edits stay local until "Save", which replaces the question list via PATCH.
 */
export default function AssignmentBuilder({ assignmentId }: { assignmentId: string }) {
  const user = useSession("TEACHER");
  const { t, fmt } = useI18n();
  const [assignment, setAssignment] = useState<FullAssignment | null>(null);
  const [loadError, setLoadError] = useState<LoadError>("");
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("[]");
  const [activeUid, setActiveUid] = useState<string | null>(null);
  // Questions that blocked a save; their errors then update live as they're edited
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());
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
      .catch((err) => setLoadError(err instanceof ApiError && err.status === 404 ? "notFound" : "loadFailed"));
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

  const errorsFor = (d: QuestionDraft) => (flagged.has(d.uid) ? validateDraft(d, t.builder.errors) : NO_ERRORS);

  function update(uid: string, next: QuestionDraft) {
    setDrafts((list) => list.map((d) => (d.uid === uid ? next : d)));
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
    setFlagged((all) => {
      const next = new Set(all);
      next.delete(uid);
      return next;
    });
  }

  // ------------------------------------------------------------- Saving

  async function save() {
    setNotice(null);
    const bad = drafts.filter((d) => hasErrors(validateDraft(d, t.builder.errors)));
    setFlagged(new Set(bad.map((d) => d.uid)));
    if (bad.length) {
      setActiveUid(bad[0].uid);
      setNotice({ kind: "needsFixing" });
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
      setNotice({ kind: "saved" });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : t.builder.saveFailed });
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
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : t.builder.visibilityFailed });
    }
  }

  function leave(e: MouseEvent) {
    if (dirty && !window.confirm(t.builder.confirmLeave)) e.preventDefault();
  }

  // ------------------------------------------------------------- Render

  if (!user) return <main className="dash"><p className="dash-muted">{t.common.status.loading}</p></main>;

  const backHref = assignment ? `/teacher?course=${assignment.courseId}` : "/teacher";
  const errorNotice = notice?.kind === "error" ? notice.text : notice?.kind === "needsFixing" ? t.builder.needsFixing : "";
  const totalPoints = drafts.reduce((sum, d) => sum + (Number.isFinite(d.points) ? d.points : 0), 0);

  return (
    <div className="builder builder-editor">
      <header className="builder-topbar">
        <Link className="link-btn" href={backHref} onClick={leave}>{t.builder.backToClass}</Link>
        <div className="builder-topbar-actions">
          <span className="save-state" aria-live="polite">
            {saving ? t.common.actions.saving : dirty ? t.builder.unsavedChanges : notice?.kind === "saved" ? t.builder.saved : ""}
          </span>
          {assignment?.status === "CREATED" && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={dirty || savedQuestionCount === 0}
              title={dirty ? t.builder.saveFirst : savedQuestionCount === 0 ? t.builder.addQuestionFirst : undefined}
              onClick={() => setPublic(true)}
            >
              {t.builder.publish}
            </button>
          )}
          {!readOnly && (
            <button type="button" className="btn btn-inline btn-small" disabled={!dirty || saving} onClick={save}>
              {t.common.actions.save}
            </button>
          )}
          <LanguageToggle />
        </div>
      </header>

      {loadError && <p className="error builder-load-error">{t.builder[loadError]}</p>}
      {!assignment && !loadError && <p className="dash-muted builder-load-error">{t.common.status.loading}</p>}

      {assignment && (
        <div className="builder-body">
          <div className="builder-column">
            <section className="form-header-card">
              <div className="form-header-top">
                <h1>{assignment.title}</h1>
                <span className={`status-pill status-${assignment.status.toLowerCase()}`}>{t.common.assignmentStatus[assignment.status]}</span>
              </div>
              {assignment.description && <p className="form-header-desc">{assignment.description}</p>}
              <p className="form-header-meta">
                {assignment.dueAt ? t.builder.dueOn(fmt.dateTime(assignment.dueAt)) : t.builder.noDueDate} ·{" "}
                {t.builder.questionCount(drafts.length)} · {t.builder.points(totalPoints)}
              </p>
            </section>

            {assignment.published && (
              <div className="view-tabs" role="tablist" aria-label={t.builder.tabs.label}>
                <button type="button" role="tab" aria-selected={tab === "questions"} className={`view-tab${tab === "questions" ? " is-active" : ""}`} onClick={() => setTab("questions")}>
                  {t.builder.tabs.questions}
                </button>
                <button type="button" role="tab" aria-selected={tab === "students"} className={`view-tab${tab === "students" ? " is-active" : ""}`} onClick={() => setTab("students")}>
                  {t.builder.tabs.students}
                </button>
              </div>
            )}

            {assignment.published && tab === "students" ? (
              <StudentResults assignmentId={assignment.id} />
            ) : (
            <>
            {readOnly && (
              <div className="builder-banner" role="note">
                <p>{t.builder.lockedBanner}</p>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setPublic(false)}>{t.builder.unpublish}</button>
              </div>
            )}

            {errorNotice && <p className="error builder-notice" role="alert">{errorNotice}</p>}

            {drafts.length === 0 ? (
              <div className="builder-empty">
                <span className="fleuron" aria-hidden="true">❦</span>
                <p>{t.builder.firstQuestion}</p>
                <div className="type-picker">
                  {TYPE_LIST.map(({ id, icon }) => (
                    <button key={id} type="button" className="type-option" onClick={() => addQuestion(id)} disabled={readOnly}>
                      {icon}
                      <span className="type-option-label">{t.builder.types[id].label}</span>
                      <span className="type-option-desc">{t.builder.types[id].description}</span>
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
                      errors={errorsFor(d)}
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
            <aside className="builder-rail" aria-label={t.builder.addQuestion}>
              {TYPE_LIST.map(({ id, icon }) => {
                const label = t.builder.addTypedQuestion(t.builder.types[id].label);
                return (
                  <button key={id} type="button" className="rail-btn" title={label} aria-label={label} onClick={() => addQuestion(id)}>
                    <span className="rail-plus" aria-hidden="true">+</span>
                    {icon}
                  </button>
                );
              })}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
