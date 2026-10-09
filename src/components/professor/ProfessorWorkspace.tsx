"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, hasSession, logout, type Assignment, type Course } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LanguageToggle from "../LanguageToggle";
import Modal from "../Modal";
import SortButton, { sortByDueDate, type SortOrder } from "../SortButton";
import AssignmentCard from "./AssignmentCard";
import AssignmentForm from "./AssignmentForm";
import ClassForm from "./ClassForm";
import ClassTree, { type CourseNode } from "./ClassTree";
import CopyButton from "./CopyButton";
import EditButton from "./EditButton";

/** Which popup is open; `course` / `assignment` present means editing it. */
type Dialog =
  | { kind: "class"; course?: Course }
  | { kind: "assignment"; assignment?: Assignment }
  | null;

export default function ProfessorWorkspace() {
  const router = useRouter();
  const { t } = useI18n();
  const tw = t.professor.workspace;
  const user = useSession("TEACHER");
  const [courses, setCourses] = useState<CourseNode[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const cardRefs = useRef(new Map<string, HTMLElement>());

  // Load every class with its assignments for the tree, alongside the session
  // check rather than after it (nothing renders until the user is confirmed)
  useEffect(() => {
    if (!hasSession()) return;
    (async () => {
      try {
        const { courses } = await api<{ courses: Course[] }>("/api/courses");
        const withAssignments = await Promise.all(
          courses.map(async (c) => {
            const { assignments } = await api<{ assignments: Assignment[] }>(`/api/courses/${c.id}/assignments`);
            return { ...c, assignments };
          }),
        );
        setCourses(withAssignments);

        // Coming back from an assignment page (/teacher?course=…) reopens its class
        const fromUrl = new URLSearchParams(window.location.search).get("course");
        if (fromUrl && withAssignments.some((c) => c.id === fromUrl)) openCourse(fromUrl);
      } catch {
        setLoadFailed(true);
      }
    })();
  }, []);

  // Bring the selected assignment's card into view
  useEffect(() => {
    if (selectedAssignmentId) {
      cardRefs.current.get(selectedAssignmentId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedAssignmentId]);

  // Tree and stack both show assignments in the chosen due-date order
  const sortedCourses = useMemo(
    () => courses?.map((c) => ({ ...c, assignments: sortByDueDate(c.assignments, sortOrder) })) ?? null,
    [courses, sortOrder],
  );
  const selectedCourse = sortedCourses?.find((c) => c.id === selectedCourseId) ?? null;

  function openCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedAssignmentId(null);
    setExpanded((prev) => new Set(prev).add(courseId));
  }

  function toggle(courseId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function onClassSaved(course: Course) {
    const exists = courses?.some((c) => c.id === course.id);
    setCourses((prev) =>
      exists
        ? prev?.map((c) => (c.id === course.id ? { ...c, ...course } : c)) ?? null
        : [{ ...course, assignments: [] }, ...(prev ?? [])],
    );
    setDialog(null);
    if (!exists) openCourse(course.id);
  }

  function onAssignmentSaved(assignment: Assignment) {
    updateCourseAssignments(assignment.courseId, (list) =>
      list.some((a) => a.id === assignment.id)
        ? list.map((a) => (a.id === assignment.id ? { ...a, ...assignment } : a))
        : [...list, assignment],
    );
    setDialog(null);
    setSelectedAssignmentId(assignment.id);
  }

  function onAssignmentDeleted(assignment: Assignment) {
    updateCourseAssignments(assignment.courseId, (list) => list.filter((a) => a.id !== assignment.id));
    setDialog(null);
    if (selectedAssignmentId === assignment.id) setSelectedAssignmentId(null);
  }

  function onAssignmentChanged(assignment: Assignment) {
    updateCourseAssignments(assignment.courseId, (list) =>
      list.map((a) => (a.id === assignment.id ? { ...a, ...assignment } : a)),
    );
  }

  function updateCourseAssignments(courseId: string, fn: (list: Assignment[]) => Assignment[]) {
    setCourses(
      (prev) =>
        prev?.map((c) => (c.id === courseId ? { ...c, assignments: fn(c.assignments) } : c)) ?? null,
    );
  }

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  if (!user) return <main className="dash"><p className="dash-muted">{t.common.status.loading}</p></main>;

  return (
    <div className="prof">
      <header className="prof-topbar">
        <span className="brand brand-sm">{t.common.appName}</span>
        <div className="prof-user">
          <span title={user.name}>{user.name}</span>
          <LanguageToggle />
          <button className="link-btn" onClick={onLogout}>{t.common.actions.logout}</button>
        </div>
      </header>

      <ClassTree
        courses={sortedCourses ?? []}
        selectedCourseId={selectedCourseId}
        expanded={expanded}
        onToggle={toggle}
        onOpenCourse={openCourse}
        onNewClass={() => setDialog({ kind: "class" })}
        newClassLabel={tw.createClass}
        assignmentHref={(a) => `/teacher/assignments/${a.id}`}
      />

      <main className="prof-main">
        {loadFailed && <p className="error">{tw.loadError}</p>}

        {!courses && !loadFailed && <p className="dash-muted">{tw.loadingClasses}</p>}

        {courses && !selectedCourse && (
          <div className="empty-state">
            <span className="fleuron" aria-hidden="true">❦</span>
            <p>{courses.length ? tw.emptyWithClasses : tw.emptyNoClasses}</p>
            <button className="btn btn-inline btn-large" onClick={() => setDialog({ kind: "class" })}>{tw.createClass}</button>
          </div>
        )}

        {selectedCourse && (
          <section className="class-view" aria-labelledby="class-title">
            <header className="class-header">
              <div>
                <div className="class-title-row">
                  <h1 id="class-title">{selectedCourse.name}</h1>
                  <EditButton label={tw.editClass} onClick={() => setDialog({ kind: "class", course: selectedCourse })} />
                </div>
                <p className="class-code">
                  {tw.joinCode} <code>{selectedCourse.joinCode}</code>
                  <CopyButton text={selectedCourse.joinCode} label={tw.copyJoinCode} />
                </p>
                <p className="class-code-help">{tw.joinCodeHelp}</p>
                {selectedCourse.description && <p className="class-desc">{selectedCourse.description}</p>}
              </div>
              {selectedCourse.assignments.length > 0 && (
                <button className="btn btn-inline" onClick={() => setDialog({ kind: "assignment" })}>{tw.newAssignment}</button>
              )}
            </header>

            {selectedCourse.assignments.length === 0 ? (
              <div className="empty-state">
                <span className="fleuron" aria-hidden="true">❦</span>
                <p>{tw.noAssignments}</p>
                <button className="btn btn-inline btn-large" onClick={() => setDialog({ kind: "assignment" })}>
                  {tw.createAssignment}
                </button>
              </div>
            ) : (
              <>
                <SortButton order={sortOrder} onChange={setSortOrder} />
                <div className="assignment-stack">
                  {selectedCourse.assignments.map((a) => (
                    <AssignmentCard
                      key={a.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(a.id, el);
                        else cardRefs.current.delete(a.id);
                      }}
                      assignment={a}
                      selected={a.id === selectedAssignmentId}
                      onChange={onAssignmentChanged}
                      onEdit={() => setDialog({ kind: "assignment", assignment: a })}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <Modal
        open={dialog?.kind === "class"}
        title={dialog?.kind === "class" && dialog.course ? tw.editClass : tw.createClass}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === "class" && (
          <ClassForm course={dialog.course} onSaved={onClassSaved} onCancel={() => setDialog(null)} />
        )}
      </Modal>

      <Modal
        open={dialog?.kind === "assignment"}
        title={dialog?.kind === "assignment" && dialog.assignment ? tw.editAssignment : tw.createAssignment}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === "assignment" && (dialog.assignment || selectedCourse) && (
          <AssignmentForm
            courseId={dialog.assignment?.courseId ?? selectedCourse!.id}
            assignment={dialog.assignment}
            onSaved={onAssignmentSaved}
            onDeleted={onAssignmentDeleted}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
    </div>
  );
}
