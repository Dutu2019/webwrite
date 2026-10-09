import { describe, expect, it } from "vitest";
import { gradeChoice, parseChoiceAnswer } from "../src/lib/grading/choice";
import { evaluate } from "../src/lib/grading";

const single = [
  { id: "a", text: "Athens", correct: false },
  { id: "b", text: "Sparta", correct: true },
  { id: "c", text: "Thebes", correct: false },
];
const multi = [
  { id: "a", text: "Plato", correct: true },
  { id: "b", text: "Cicero", correct: false },
  { id: "c", text: "Aristotle", correct: true },
];

describe("multiple choice grading", () => {
  it("parses comma lists and JSON arrays", () => {
    expect(parseChoiceAnswer("a, c")).toEqual(["a", "c"]);
    expect(parseChoiceAnswer('["a","c"]')).toEqual(["a", "c"]);
  });

  it("marks a single correct option", () => {
    expect(gradeChoice(single, "b")).toMatchObject({ isCorrect: true, score: 100 });
    expect(gradeChoice(single, "a")).toMatchObject({ isCorrect: false, score: 0 });
  });

  it("needs the exact set for select-all-that-apply", () => {
    expect(gradeChoice(multi, "a,c")).toMatchObject({ isCorrect: true, score: 100 });
    expect(gradeChoice(multi, "a")).toMatchObject({ isCorrect: false, score: 50 });
    expect(gradeChoice(multi, "a,b,c")).toMatchObject({ isCorrect: false, score: 50 });
  });

  it("ignores unknown ids and never reveals the answer", () => {
    const r = gradeChoice(single, "zzz");
    expect(r.isCorrect).toBe(false);
    expect(r.feedback).not.toMatch(/Sparta/);
  });

  it("evaluate() routes multiple choice away from the text grader", async () => {
    const r = await evaluate({ prompt: "p", reference: "Sparta", choices: single, studentAnswer: "b", attemptNumber: 1 });
    expect(r.isCorrect).toBe(true);
    expect(r.criteriaScores).toEqual([]);
  });
});
