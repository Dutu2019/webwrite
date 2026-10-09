import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { translateServerText } from "@/lib/i18n/serverText";

describe("i18n config", () => {
  it("defaults to Quebec French", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });
});

describe("dictionaries", () => {
  // Walk both dictionaries together: same keys, no empty strings, same function arity.
  function compare(fr: unknown, en: unknown, path: string) {
    if (typeof fr === "string") {
      expect(fr.trim(), `${path} (fr) is empty`).not.toBe("");
      expect(typeof en, `${path} type`).toBe("string");
      expect((en as string).trim(), `${path} (en) is empty`).not.toBe("");
      return;
    }
    if (typeof fr === "function") {
      expect(typeof en, `${path} type`).toBe("function");
      expect((en as (...a: unknown[]) => unknown).length, `${path} arity`).toBe(fr.length);
      return;
    }
    const frObj = fr as Record<string, unknown>;
    const enObj = en as Record<string, unknown>;
    expect(Object.keys(enObj).sort(), `${path} keys`).toEqual(Object.keys(frObj).sort());
    for (const key of Object.keys(frObj)) compare(frObj[key], enObj[key], `${path}.${key}`);
  }

  it("English matches French key for key", () => {
    compare(MESSAGES.fr, MESSAGES.en, "messages");
  });
});

describe("server text", () => {
  it("translates API errors and generated feedback to French", () => {
    expect(translateServerText("Invalid email or password", "fr")).toBe("Courriel ou mot de passe incorrect.");
    expect(translateServerText("All key ideas included.", "fr")).toBe("Toutes les idées clés sont incluses.");
    expect(translateServerText("You're close on Idea 2. Be more specific.", "fr")).toBe(
      "Vous y êtes presque pour l'idée 2. Soyez plus précis.",
    );
  });

  it("leaves English, unknown, and teacher-written text unchanged", () => {
    expect(translateServerText("All key ideas included.", "en")).toBe("All key ideas included.");
    expect(translateServerText("Quel est le rôle du proton?", "fr")).toBe("Quel est le rôle du proton?");
    expect(translateServerText(null, "fr")).toBeNull();
  });
});
