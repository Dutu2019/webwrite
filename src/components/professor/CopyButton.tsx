"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Clipboard icon that copies `text`; it turns gray for a moment once copied. */
export default function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 700);
    } catch {
      /* clipboard blocked; the text is still visible to copy by hand */
    }
  }

  return (
    <button
      type="button"
      className={`icon-btn copy-btn${copied ? " is-copied" : ""}`}
      aria-label={label}
      title={label}
      onClick={copy}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className="visually-hidden" aria-live="polite">{copied ? t.common.actions.copied : ""}</span>
    </button>
  );
}
