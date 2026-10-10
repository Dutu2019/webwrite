"use client";

import type { Assignment } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type SortOrder = "latest" | "soonest";

/** Sort by due date in either direction; assignments without one always go last. */
export function sortByDueDate<T extends Pick<Assignment, "dueAt">>(list: T[], order: SortOrder): T[] {
  return [...list].sort((a, b) => {
    if (!a.dueAt || !b.dueAt) return Number(!a.dueAt) - Number(!b.dueAt);
    const diff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    return order === "soonest" ? diff : -diff;
  });
}

/** Pill toggle above an assignment stack that flips the due-date order. */
export default function SortButton({ order, onChange }: { order: SortOrder; onChange: (o: SortOrder) => void }) {
  const { t } = useI18n();
  const soonest = order === "soonest";
  return (
    <div className="stack-toolbar">
      <button
        type="button"
        className="sort-btn"
        aria-label={t.common.sort.label(soonest)}
        onClick={() => onChange(order === "latest" ? "soonest" : "latest")}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M8 4v16m0 0-4-4m4 4 4-4M16 20V4m0 0-4 4m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {soonest ? t.common.sort.soonest : t.common.sort.latest}
      </button>
    </div>
  );
}
