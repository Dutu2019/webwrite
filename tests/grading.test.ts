import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluate } from "@/lib/grading";
import {
  batchPrompt,
  loadReply,
  parseBatch,
  type Question,
} from "@/lib/grading/gemma";
import type { GradingInput } from "@/lib/grading";

const criteria = [
  { key: "idea_a", weight: 0.6, description: "States idea A." },
  { key: "idea_b", weight: 0.4, description: "States idea B.", hint: "Add idea B." },
];

function geminiReply(answer: unknown, finishReason = "STOP"): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        { finishReason, content: { parts: [{ text: JSON.stringify(answer) }] } },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function input(overrides: Partial<GradingInput> = {}): GradingInput {
  return {
    prompt: "Explain free fall.",
    reference: "t = sqrt(2h/g)",
    criteria,
    studentAnswer: "The ball accelerates under gravity.",
    attemptNumber: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("grading with hosted Gemma (Gemini API)", () => {
  it("maps criterion rubric levels to a weighted score", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      geminiReply({ idea_0: 2, idea_1: 1, incorrect: false }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await evaluate(
      input({ prompt: "map-levels", studentAnswer: "answer one" }),
    );

    expect(result.criteriaScores.map((s) => s.status)).toEqual([
      "included",
      "in_progress",
    ]);
    expect(result.score).toBe(80); // (100*0.6 + 50*0.4) / 1.0
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toBe("Add idea B.");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("marks the answer correct only when every idea is included", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () =>
      geminiReply({ idea_0: 2, idea_1: 2, incorrect: false }),
    ));

    const result = await evaluate(
      input({ prompt: "all-included", studentAnswer: "answer two" }),
    );

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(result.feedback).toBe("All key ideas included.");
  });

  it("blocks completion when the answer is flagged incorrect", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () =>
      geminiReply({ idea_0: 2, idea_1: 2, incorrect: true }),
    ));

    const result = await evaluate(
      input({ prompt: "flagged", studentAnswer: "answer three" }),
    );

    expect(result.flaggedIncorrect).toBe(true);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toMatch(/accurate/i);
  });

  it("treats an insufficient (null) level as not completed", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () =>
      geminiReply({ idea_0: null, idea_1: 2, incorrect: false }),
    ));

    const result = await evaluate(
      input({ prompt: "insufficient", studentAnswer: "answer four" }),
    );

    expect(result.criteriaScores[0].status).toBe("not_completed");
  });

  it("requires GEMINI_API_KEY", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      evaluate(input({ prompt: "no-key", studentAnswer: "answer five" })),
    ).rejects.toMatchObject({ status: 503, code: "GRADING_UNAVAILABLE" });
  });

  it("rejects invalid model output instead of guessing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply({ nope: 1 })));
    await expect(
      evaluate(input({ prompt: "bad-output", studentAnswer: "answer six" })),
    ).rejects.toMatchObject({ status: 502, code: "GRADING_INVALID" });
  });

  it("rejects blocked or truncated generations", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () =>
      geminiReply({ idea_0: 2, idea_1: 2, incorrect: false }, "MAX_TOKENS"),
    ));
    await expect(
      evaluate(input({ prompt: "blocked", studentAnswer: "answer seven" })),
    ).rejects.toMatchObject({ status: 502, code: "GRADING_INVALID" });
  });

  it("requires at least one criterion", async () => {
    await expect(
      evaluate(
        input({ prompt: "no-criteria", studentAnswer: "answer eight", criteria: [] }),
      ),
    ).rejects.toMatchObject({ status: 422, code: "GRADING_INPUT_INVALID" });
  });
});

describe("batch prompt and parsing", () => {
  it("accepts a single fenced JSON block", () => {
    expect(loadReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("rejects malformed or non-object replies", () => {
    expect(() => loadReply("not json")).toThrow();
    expect(() => loadReply("[1,2,3]")).toThrow();
  });

  it("validates every supplied question and allowed value", () => {
    const questions: Record<string, Question> = {
      a: { kind: "score", instructions: "x", rubric: ["no", "yes"] },
      b: { kind: "boolean", condition: "y" },
    };
    const answers = parseBatch('{"a":1,"b":false}', questions);
    expect(answers.a).toMatchObject({ value: 1, label: "yes", status: "decided" });
    expect(answers.b).toMatchObject({ value: false, status: "decided" });
    expect(() => parseBatch('{"a":5,"b":false}', questions)).toThrow();
    expect(() => parseBatch('{"a":1}', questions)).toThrow();
  });

  it("builds an output shape that names each question", () => {
    const prompt = batchPrompt("CTX", {
      idea_0: { kind: "score", instructions: "i", rubric: ["a", "b"] },
    });
    expect(prompt).toContain("CTX");
    expect(prompt).toContain('"idea_0": zero-based integer rubric index|null');
  });
});
