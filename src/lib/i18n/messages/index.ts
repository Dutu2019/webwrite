import type { Locale } from "../config";
import builder from "./builder";
import common from "./common";
import login from "./login";
import professor from "./professor";
import student from "./student";

const namespaces = { common, login, student, professor, builder };

type Namespaces = typeof namespaces;
export type Messages = { [K in keyof Namespaces]: Namespaces[K]["fr"] };

function forLocale(locale: Locale): Messages {
  return Object.fromEntries(
    Object.entries(namespaces).map(([name, ns]) => [name, ns[locale]]),
  ) as Messages;
}

export const MESSAGES: Record<Locale, Messages> = { fr: forLocale("fr"), en: forLocale("en") };
