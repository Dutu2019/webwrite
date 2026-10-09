import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluate } from "@/lib/grading";
import {
  batchPrompt,
  hintWithGemma,
  loadReply,
  parseBatch,
  parseHint,
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

describe("transient Gemini failures", () => {
  const ok = () => geminiReply({ idea_0: 2, idea_1: 2, incorrect: false });

  it("retries once after a 5xx and accepts the second reply", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("oops", { status: 500 }))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);

    const result = await evaluate(input({ prompt: "retry-5xx", studentAnswer: "r1" }));
    expect(result.isCorrect).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once after a dropped connection", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);

    await evaluate(input({ prompt: "retry-network", studentAnswer: "r2" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second 5xx", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response("oops", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      evaluate(input({ prompt: "retry-twice", studentAnswer: "r3" })),
    ).rejects.toMatchObject({ status: 502, code: "GRADING_UPSTREAM" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a timeout, a 429, or invalid output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const timeout = Object.assign(new Error("slow"), { name: "TimeoutError" });
    const cases: Array<[() => Promise<Response>, number]> = [
      [async () => { throw timeout; }, 504],
      [async () => new Response("", { status: 429 }), 429],
      [async () => geminiReply({ nope: 1 }), 502],
    ];
    for (const [i, [impl, status]] of cases.entries()) {
      const fetchMock = vi.fn(impl);
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        evaluate(input({ prompt: `no-retry-${i}`, studentAnswer: `r4-${i}` })),
      ).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledOnce();
    }
  });
});

describe("incorrect-statement check", () => {
  it("is skipped when checkIncorrect is false (essays)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      geminiReply({ idea_0: 2, idea_1: 2 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await evaluate(
      input({ prompt: "essay", studentAnswer: "e1", checkIncorrect: false }),
    );
    const sentPrompt = String(fetchMock.mock.calls[0]![1].body);
    expect(sentPrompt).not.toContain("factually incorrect");
    expect(result.flaggedIncorrect).toBe(false);
    expect(result.isCorrect).toBe(true);
  });
});

describe("Gemma hints", () => {
  it("returns the hint text from a valid reply", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      geminiReply({ hint: "You've named gravity. What equation links height and time?" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const hint = await hintWithGemma({
      prompt: "Explain free fall.",
      reference: "t = sqrt(2h/g)",
      studentAnswer: "It falls because of gravity.",
      ideas: [{ idea: "Uses t = sqrt(2h/g).", status: "not_completed" }],
    });

    expect(hint).toMatch(/gravity/);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contents[0].parts[0].text).toContain("referenceDoNotReveal");
  });

  it("rejects replies without a usable hint", () => {
    expect(() => parseHint('{"hint": ""}', "ref")).toThrow();
    expect(() => parseHint('{"hint": 3}', "ref")).toThrow();
    expect(() => parseHint('{"nope": "x"}', "ref")).toThrow();
  });

  it("rejects a hint that repeats the answer key", () => {
    const reference = "The positively charged nuclei attract the shared electrons between them";
    expect(() => parseHint(JSON.stringify({ hint: `Say that ${reference}.` }), reference)).toThrow();
    expect(parseHint('{"hint": "Which particles attract the shared pair?"}', reference)).toMatch(/particles/);
  });
});
