"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, logout, type Assignment, type Course } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import Modal from "../Modal";
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

type SortOrder = "latest" | "soonest";

/** Sort by due date in either direction; assignments without one always go last. */
function sortByDueDate(list: Assignment[], order: SortOrder) {
  return [...list].sort((a, b) => {
    if (!a.dueAt || !b.dueAt) return Number(!a.dueAt) - Number(!b.dueAt);
    const diff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    return order === "soonest" ? diff : -diff;
  });
}

export default function ProfessorWorkspace() {
  const router = useRouter();
  const user = useSession("TEACHER");
  const [courses, setCourses] = useState<CourseNode[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const cardRefs = useRef(new Map<string, HTMLElement>());

  // Load every class with its assignments for the tree
  useEffect(() => {
    if (!user) return;
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
        setLoadError("Couldn't load your classes.");
      }
    })();
  }, [user]);

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
        ? list.map((a) => (a.id === assignment.id ? assignment : a))
        : [...list, assignment],
    );
    setDialog(null);
    setSelectedAssignmentId(assignment.id);
  }

  function onAssignmentChanged(assignment: Assignment) {
    updateCourseAssignments(assignment.courseId, (list) => list.map((a) => (a.id === assignment.id ? assignment : a)));
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

  if (!user) return <main className="dash"><p className="dash-muted">Loading…</p></main>;

  return (
    <div className="prof">
      <header className="prof-topbar">
        <span className="brand brand-sm">WebWrite</span>
        <div className="prof-user">
          <span>{user.name}</span>
          <button className="link-btn" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <ClassTree
        courses={sortedCourses ?? []}
        selectedCourseId={selectedCourseId}
        expanded={expanded}
        onToggle={toggle}
        onOpenCourse={openCourse}
        onNewClass={() => setDialog({ kind: "class" })}
      />

      <main className="prof-main">
        {loadError && <p className="error">{loadError}</p>}

        {!courses && !loadError && <p className="dash-muted">Loading your classes…</p>}

        {courses && !selectedCourse && (
          <div className="empty-state">
            <span className="fleuron" aria-hidden="true">❦</span>
            <p>{courses.length ? "Open a class from the left, or begin a new one." : "Begin by creating your first class."}</p>
            <button className="btn btn-inline btn-large" onClick={() => setDialog({ kind: "class" })}>Create class</button>
          </div>
        )}

        {selectedCourse && (
          <section className="class-view" aria-labelledby="class-title">
            <header className="class-header">
              <div>
                <div className="class-title-row">
                  <h1 id="class-title">{selectedCourse.name}</h1>
                  <EditButton label="Edit class" onClick={() => setDialog({ kind: "class", course: selectedCourse })} />
                </div>
                <p className="class-code">
                  Join code <code>{selectedCourse.joinCode}</code>
                  <CopyButton text={selectedCourse.joinCode} label="Copy the join code to share with students" />
                </p>
                <p className="class-code-help">Share this code with students so they can join the class.</p>
                {selectedCourse.description && <p className="class-desc">{selectedCourse.description}</p>}
              </div>
              {selectedCourse.assignments.length > 0 && (
                <button className="btn btn-inline" onClick={() => setDialog({ kind: "assignment" })}>New assignment</button>
              )}
            </header>

            {selectedCourse.assignments.length === 0 ? (
              <div className="empty-state">
                <span className="fleuron" aria-hidden="true">❦</span>
                <p>No assignments in this class yet.</p>
                <button className="btn btn-inline btn-large" onClick={() => setDialog({ kind: "assignment" })}>
                  Create assignment
                </button>
              </div>
            ) : (
              <>
              <div className="stack-toolbar">
                <button
                  type="button"
                  className="sort-btn"
                  aria-label={`Sorted by due date, ${sortOrder === "soonest" ? "soonest" : "latest"} first. Click to reverse.`}
                  onClick={() => setSortOrder((o) => (o === "latest" ? "soonest" : "latest"))}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M8 4v16m0 0-4-4m4 4 4-4M16 20V4m0 0-4 4m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Due date: {sortOrder === "soonest" ? "soonest first" : "latest first"}
                </button>
              </div>
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
        title={dialog?.kind === "class" && dialog.course ? "Edit class" : "Create class"}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === "class" && (
          <ClassForm course={dialog.course} onSaved={onClassSaved} onCancel={() => setDialog(null)} />
        )}
      </Modal>

      <Modal
        open={dialog?.kind === "assignment"}
        title={dialog?.kind === "assignment" && dialog.assignment ? "Edit assignment" : "Create assignment"}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === "assignment" && (dialog.assignment || selectedCourse) && (
          <AssignmentForm
            courseId={dialog.assignment?.courseId ?? selectedCourse!.id}
            assignment={dialog.assignment}
            onSaved={onAssignmentSaved}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
    </div>
  );
}
