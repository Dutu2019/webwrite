import { describe, expect, it } from "vitest";
import { hasMath, parseMath, parseMathWithAuto } from "../src/components/MathText";

describe("LaTeX parsing", () => {
  it("splits inline and display math", () => {
    expect(parseMath("Area $\\pi r^2$ and $$\\int f$$ done")).toEqual([
      { kind: "text", value: "Area " },
      { kind: "math", value: "\\pi r^2", display: false },
      { kind: "text", value: " and " },
      { kind: "math", value: "\\int f", display: true },
      { kind: "text", value: " done" },
    ]);
  });

  it("supports \\( \\) and \\[ \\] delimiters", () => {
    expect(parseMath("\\(x\\) \\[y\\]").filter((s) => s.kind === "math")).toEqual([
      { kind: "math", value: "x", display: false },
      { kind: "math", value: "y", display: true },
    ]);
  });

  it("keeps escaped and unpaired dollars as text", () => {
    expect(hasMath("It costs \\$5 and \\$10")).toBe(false);
    expect(parseMath("It costs \\$5")).toEqual([{ kind: "text", value: "It costs $5" }]);
    expect(hasMath("Plain text")).toBe(false);
  });

  it("adds plain-text math outside delimiters but not inside them", () => {
    expect(parseMathWithAuto("Half is 1/2, or $\\frac{a}{b}$")).toEqual([
      { kind: "text", value: "Half is " },
      { kind: "math", value: "\\frac{1}{2}", display: false },
      { kind: "text", value: ", or " },
      { kind: "math", value: "\\frac{a}{b}", display: false },
    ]);
    expect(hasMath("Solve x/2")).toBe(true);
    expect(hasMath("and/or")).toBe(false);
  });
});
