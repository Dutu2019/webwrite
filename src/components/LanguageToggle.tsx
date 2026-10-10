"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

/** Small pill that switches between French and English. */
export default function LanguageToggle({ className }: { className?: string }) {
  const { locale, t, setLocale } = useI18n();
  return (
    <button
      type="button"
      className={`lang-toggle${className ? ` ${className}` : ""}`}
      lang={locale === "fr" ? "en" : "fr"}
      aria-label={t.common.language.switchToLabel}
      onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
    >
      {t.common.language.switchTo}
    </button>
  );
}
