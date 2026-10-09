"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, getMe, hasSession, homeFor, logout, type Role, type User } from "@/lib/client/api";

interface Course {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  teacher?: { name: string };
}

/**
 * Placeholder home for each role: checks the session, then lists courses.
 * The real student/professor views (assignments, Jev feedback) build on this.
 */
export default function Dashboard({ role }: { role: Role }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasSession()) {
      router.replace("/");
      return;
    }
    (async () => {
      try {
        const me = await getMe();
        if (me.role !== role) return router.replace(homeFor(me.role));
        setUser(me);
        const path = role === "TEACHER" ? "/api/courses" : "/api/student/courses";
        setCourses((await api<{ courses: Course[] }>(path)).courses);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace("/");
        else setError("Couldn't load your courses.");
      }
    })();
  }, [role, router]);

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
      <p className="dash-muted">{role === "TEACHER" ? "Your courses" : "Courses you're enrolled in"}</p>

      {error && <p className="error">{error}</p>}
      {courses?.length === 0 && <p className="dash-muted">No courses yet.</p>}
      <ul className="course-list">
        {courses?.map((c) => (
          <li key={c.id} className="course-card">
            <h2>{c.name}</h2>
            {c.description && <p>{c.description}</p>}
            <p className="dash-muted">
              {role === "TEACHER" ? <>Join code: <code>{c.joinCode}</code></> : c.teacher && <>Taught by {c.teacher.name}</>}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
