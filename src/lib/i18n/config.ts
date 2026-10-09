/** Interface languages. Quebec French is the default; English is the alternative. */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Cookie holding the chosen language, so server-rendered HTML matches it from the first byte. */
export const LOCALE_COOKIE = "webwrite.locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** BCP 47 tags for `<html lang>` and Intl date/number formatting. */
export const LOCALE_TAG: Record<Locale, string> = { fr: "fr-CA", en: "en-CA" };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);
