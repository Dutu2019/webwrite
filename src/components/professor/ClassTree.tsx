"use client";

import Link from "next/link";
import type { Assignment, Course } from "@/lib/client/api";

export type CourseNode = Course & { assignments: Assignment[] };

/**
 * Left sidebar: each class, with its assignments nested underneath.
 * A class name opens the class; an assignment name goes to `assignmentHref`.
 * Shared by the professor and student workspaces.
 */
export default function ClassTree({
  courses,
  selectedCourseId,
  expanded,
  onToggle,
  onOpenCourse,
  onNewClass,
  newClassLabel,
  assignmentHref,
}: {
  courses: CourseNode[];
  selectedCourseId: string | null;
  expanded: Set<string>;
  onToggle: (courseId: string) => void;
  onOpenCourse: (courseId: string) => void;
  onNewClass: () => void;
  newClassLabel: string;
  assignmentHref: (a: Assignment) => string;
}) {
  return (
    <nav className="tree" aria-label="Your classes">
      <div className="tree-header">
        <h2>Classes</h2>
        <button type="button" className="tree-add" onClick={onNewClass} aria-label={newClassLabel} title={newClassLabel}>+</button>
      </div>

      {courses.length === 0 && <p className="tree-empty">No classes yet.</p>}

      <ul className="tree-list">
        {courses.map((c) => {
          const open = expanded.has(c.id);
          return (
            <li key={c.id}>
              <div className={`tree-row${c.id === selectedCourseId ? " is-selected" : ""}`}>
                <button
                  type="button"
                  className={`tree-caret${open ? " is-open" : ""}`}
                  aria-expanded={open}
                  aria-label={open ? `Collapse ${c.name}` : `Expand ${c.name}`}
                  onClick={() => onToggle(c.id)}
                >
                  ▸
                </button>
                <button type="button" className="tree-label" onClick={() => onOpenCourse(c.id)}>
                  <span className="tree-name">{c.name}</span>
                  <span className="tree-code">{c.joinCode}</span>
                </button>
              </div>

              {open && (
                <ul className="tree-children">
                  {c.assignments.length === 0 && <li className="tree-empty">No assignments</li>}
                  {c.assignments.map((a) => (
                    <li key={a.id} className="tree-leaf-row">
                      <Link className="tree-leaf" href={assignmentHref(a)}>
                        <span className={`status-dot status-${a.status.toLowerCase()}`} aria-hidden="true" />
                        <span className="tree-leaf-title">{a.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
