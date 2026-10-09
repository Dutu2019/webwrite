import { describe, expect, it } from "vitest";
import { evaluate } from "../src/lib/grading";

// Gemma is the default backend; these tests cover the offline stub.
process.env.GRADING_BACKEND = "stub";

const reference = "t = sqrt(2h/g) = sqrt(40/9.8) ≈ 2.02 s";

describe("grading stub (jevStub via evaluate)", () => {
  it("scores a detailed, reasoned answer highly", async () => {
    const res = await evaluate({
      prompt: "How long until the ball hits the ground?",
      reference,
      studentAnswer:
        "Because the ball falls freely under gravity, I use the free-fall relation t = sqrt(2h/g). Substituting h = 20 gives t = sqrt(40/9.8), therefore the time is about 2.02 seconds.",
      attemptNumber: 1,
    });
    expect(res.score).toBeGreaterThan(60);
    expect(res.criteriaScores.length).toBeGreaterThan(0);
    expect(res.feedback.length).toBeGreaterThan(0);
    expect(typeof res.isCorrect).toBe("boolean");
  });

  it("scores a terse answer lowly", async () => {
    const res = await evaluate({
      prompt: "How long until the ball hits the ground?",
      reference,
      studentAnswer: "idk",
      attemptNumber: 1,
    });
    expect(res.score).toBeLessThan(50);
  });

  it("does not penalize repeated attempts (effort bonus applies)", async () => {
    const answer = "The ball accelerates downward under gravity and I compute the time.";
    const first = await evaluate({ prompt: "q", reference, studentAnswer: answer, attemptNumber: 1 });
    const later = await evaluate({ prompt: "q", reference, studentAnswer: answer, attemptNumber: 5 });
    expect(later.score).toBeGreaterThanOrEqual(first.score);
  });

  it("honors custom criterion keys", async () => {
    const res = await evaluate({
      prompt: "q",
      reference,
      criteria: [
        { key: "completeness", weight: 1 },
        { key: "clarity", weight: 1 },
      ],
      studentAnswer: "This is a clear sentence. Here is another sentence with detail.",
      attemptNumber: 1,
    });
    expect(res.criteriaScores.map((c) => c.key)).toEqual(["completeness", "clarity"]);
  });
});
