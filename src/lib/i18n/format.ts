import { LOCALE_TAG, type Locale } from "./config";

/** Locale-aware formatting. French uses Quebec conventions ("9 oct. 2026", "14 h 30"). */
export function formatters(locale: Locale) {
  const tag = LOCALE_TAG[locale];
  const dateFmt = new Intl.DateTimeFormat(tag, { year: "numeric", month: "short", day: "numeric" });
  const dateTimeFmt = new Intl.DateTimeFormat(tag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const numberFmt = new Intl.NumberFormat(tag);
  return {
    date: (value: string | number | Date) => dateFmt.format(new Date(value)),
    dateTime: (value: string | number | Date) => dateTimeFmt.format(new Date(value)),
    number: (value: number) => numberFmt.format(value),
  };
}

export type Formatters = ReturnType<typeof formatters>;
