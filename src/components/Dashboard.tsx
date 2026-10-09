"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, logout, type Course } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";

/**
 * Placeholder student home: lists enrolled courses.
 * The real student view (assignments, Jev feedback) builds on this.
 */
export default function Dashboard() {
  const router = useRouter();
  const user = useSession("STUDENT");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ courses: Course[] }>("/api/student/courses")
      .then((d) => setCourses(d.courses))
      .catch(() => setError("Couldn't load your courses."));
  }, [user]);

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  if (!user) return <main className="dash"><p className="dash-muted">Loading…</p></main>;

  return (
    <main className="dash">
      <header className="dash-header">
        <span className="brand brand-sm">WebWrite</span>
        <button className="link-btn" onClick={onLogout}>Log out</button>
      </header>

      <h1 className="dash-title">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="dash-muted">Courses you&apos;re enrolled in</p>

      {error && <p className="error">{error}</p>}
      {courses?.length === 0 && <p className="dash-muted">No courses yet.</p>}
      <ul className="course-list">
        {courses?.map((c) => (
          <li key={c.id} className="course-card">
            <h2>{c.name}</h2>
            {c.description && <p>{c.description}</p>}
            {c.teacher && <p className="dash-muted">Taught by {c.teacher.name}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
