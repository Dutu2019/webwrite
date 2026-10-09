import { describe, expect, it } from "vitest";
import { autoMath, exprToLatex } from "../src/components/autoMath";

const math = (text: string) => autoMath(text).filter((s) => s.kind === "math").map((s) => s.value);

describe("plain-text math detection", () => {
  it("turns fractions, powers and roots into LaTeX", () => {
    expect(math("Solve x/2 = 4")).toEqual(["\\frac{x}{2}"]);
    expect(math("(a+b)/2 is the mean")).toEqual(["\\frac{a+b}{2}"]);
    expect(math("area is r^2 times pi")).toEqual(["r^{2}"]);
    expect(math("x^(n+1)/(n+1)")).toEqual(["\\frac{x^{n+1}}{n+1}"]);
    expect(math("sqrt(2) is irrational")).toEqual(["\\sqrt{2}"]);
    expect(math("half is 1/2")).toEqual(["\\frac{1}{2}"]);
    expect(math("3x/4")).toEqual(["\\frac{3x}{4}"]);
  });

  it("leaves ordinary prose alone", () => {
    expect(math("and/or")).toEqual([]);
    expect(math("Signed on 10/09/2026.")).toEqual([]);
    expect(math("See http://example.com/a/b")).toEqual([]);
    expect(math("w/ friends")).toEqual([]);
    expect(math("The 1920s were loud")).toEqual([]);
  });

  it("keeps the surrounding text intact", () => {
    expect(autoMath("Let x/2 be")).toEqual([
      { kind: "text", value: "Let " },
      { kind: "math", value: "\\frac{x}{2}" },
      { kind: "text", value: " be" },
    ]);
  });

  it("converts operators inside groups", () => {
    expect(exprToLatex("(a*b)/(c)")).toBe("\\frac{a\\cdot b}{c}");
  });
});
