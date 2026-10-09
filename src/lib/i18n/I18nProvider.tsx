"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { setApiLocale } from "@/lib/client/api";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_TAG, type Locale } from "./config";
import { formatters, type Formatters } from "./format";
import { MESSAGES, type Messages } from "./messages";
import { translateServerText } from "./serverText";

interface I18n {
  locale: Locale;
  /** Dictionary for the current language: `t.common.actions.save`, `t.common.idea(2)`. */
  t: Messages;
  /** Dates and numbers in the current language. */
  fmt: Formatters;
  /** Translate API messages and generated feedback; teacher-written text passes through. */
  server: (text: string | null) => string | null;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n | null>(null);

/** Mounted once in the root layout with the language the server read from the cookie. */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialLocale);
  // API error messages are translated where they're thrown (outside React)
  setApiLocale(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      document.documentElement.lang = LOCALE_TAG[next];
      setApiLocale(next);
      setLocaleState(next);
      router.refresh(); // re-render server components (page metadata, credits) in the new language
    },
    [router],
  );

  const value = useMemo<I18n>(
    () => ({
      locale,
      t: MESSAGES[locale],
      fmt: formatters(locale),
      server: (text) => translateServerText(text, locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
