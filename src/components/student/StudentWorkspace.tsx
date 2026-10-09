"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, logout, type Course, type StudentAssignment } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import Modal from "../Modal";
import ClassTree from "../professor/ClassTree";
import SortButton, { sortByDueDate, type SortOrder } from "../SortButton";
import JoinClassForm from "./JoinClassForm";
import StudentAssignmentCard from "./StudentAssignmentCard";

type StudentCourse = Course & { assignments: StudentAssignment[] };

/**
 * Student home, laid out like the professor's: enrolled classes on the left,
 * the open class's posted and closed assignments in the middle.
 */
export default function StudentWorkspace() {
  const router = useRouter();
  const user = useSession("STUDENT");
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("soonest");

  const openCourse = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setExpanded((prev) => new Set(prev).add(courseId));
  }, []);

  // Classes plus every visible assignment (the API only returns posted and closed ones)
  const load = useCallback(async () => {
    const [{ courses }, { assignments }] = await Promise.all([
      api<{ courses: Course[] }>("/api/student/courses"),
      api<{ assignments: StudentAssignment[] }>("/api/student/assignments"),
    ]);
    const withAssignments = courses.map((c) => ({ ...c, assignments: assignments.filter((a) => a.course.id === c.id) }));
    setCourses(withAssignments);
    return withAssignments;
  }, []);

  useEffect(() => {
    if (!user) return;
    load()
      .then((list) => {
        // Coming back from an assignment (/student?course=…) reopens its class
        const fromUrl = new URLSearchParams(window.location.search).get("course");
        if (fromUrl && list.some((c) => c.id === fromUrl)) openCourse(fromUrl);
      })
      .catch(() => setLoadError("Couldn't load your classes."));
  }, [user, load, openCourse]);

  const sortedCourses = useMemo(
    () => courses?.map((c) => ({ ...c, assignments: sortByDueDate(c.assignments, sortOrder) })) ?? null,
    [courses, sortOrder],
  );
  const selectedCourse = sortedCourses?.find((c) => c.id === selectedCourseId) ?? null;

  function toggle(courseId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  async function onJoined(course: Course) {
    setJoining(false);
    try {
      await load();
    } catch {
      setLoadError("Joined, but couldn't refresh your classes. Reload the page.");
    }
    openCourse(course.id);
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
        onNewClass={() => setJoining(true)}
        newClassLabel="Join a class"
        assignmentHref={(a) => `/student/assignments/${a.id}`}
      />

      <main className="prof-main">
        {loadError && <p className="error">{loadError}</p>}
        {!courses && !loadError && <p className="dash-muted">Loading your classes…</p>}

        {courses && !selectedCourse && (
          <div className="empty-state">
            <span className="fleuron" aria-hidden="true">❦</span>
            <p>{courses.length ? "Open a class from the left, or join another." : "Join your first class with the code your professor gave you."}</p>
            <button className="btn btn-inline btn-large" onClick={() => setJoining(true)}>Join a class</button>
          </div>
        )}

        {selectedCourse && (
          <section className="class-view" aria-labelledby="class-title">
            <header className="class-header">
              <div>
                <h1 id="class-title">{selectedCourse.name}</h1>
                {selectedCourse.teacher && <p className="class-code">Taught by {selectedCourse.teacher.name}</p>}
                {selectedCourse.description && <p className="class-desc">{selectedCourse.description}</p>}
              </div>
            </header>

            {selectedCourse.assignments.length === 0 ? (
              <div className="empty-state">
                <span className="fleuron" aria-hidden="true">❦</span>
                <p>No assignments posted yet.</p>
              </div>
            ) : (
              <>
                <SortButton order={sortOrder} onChange={setSortOrder} />
                <div className="assignment-stack">
                  {selectedCourse.assignments.map((a) => (
                    <StudentAssignmentCard key={a.id} assignment={a} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <Modal open={joining} title="Join a class" onClose={() => setJoining(false)}>
        <JoinClassForm onJoined={onJoined} onCancel={() => setJoining(false)} />
      </Modal>
    </div>
  );
}
