import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "./index.ts";
import { MockProvider } from "./mock-provider.ts";
import { OpenAIProvider, CustomOpenAICompatibleProvider } from "./openai-provider.ts";

describe("createProvider", () => {
  it("unknown provider id falls back to MockProvider", () => {
    const unknown = createProvider({ providerId: "unknown-id" });
    assert.ok(unknown instanceof MockProvider);
    assert.strictEqual(unknown.id, "mock");

    const nullId = createProvider({ providerId: null });
    assert.ok(nullId instanceof MockProvider);

    const missing = createProvider({});
    assert.ok(missing instanceof MockProvider);

    const empty = createProvider({ providerId: "" });
    assert.ok(empty instanceof MockProvider);
  });

  it("openai/custom-openai provider ids create non-mock providers without real network calls", () => {
    const openai = createProvider({ providerId: "openai" });
    assert.ok(openai instanceof OpenAIProvider);
    assert.ok(!(openai instanceof MockProvider));
    assert.strictEqual(openai.id, "openai");

    const custom = createProvider({ providerId: "custom-openai" });
    assert.ok(custom instanceof CustomOpenAICompatibleProvider);
    assert.ok(!(custom instanceof MockProvider));
    assert.strictEqual(custom.id, "custom-openai");

    // creation only; no generateText/generateJSON called => no fetch
  });
});

type MockJudgeResult = {
  round: number;
  confidence: number;
  scores: {
    A: { total: number };
    B: { total: number };
  };
};

describe("MockProvider numeric metadata", () => {
  it("falls back for invalid numeric metadata without producing NaN outputs", async () => {
    const provider = new MockProvider();

    for (const round of ["abc", "NaN", "Infinity", NaN, Infinity, -Infinity]) {
      const input = { messages: [{ role: "user" as const, content: "hi" }], metadata: { round } };
      const judge = await provider.generateJSON<MockJudgeResult>(input);
      const speech = await provider.generateText(input);

      assert.equal(judge.round, 1);
      assert.ok(Number.isFinite(judge.confidence));
      assert.ok(Number.isFinite(judge.scores.A.total));
      assert.ok(Number.isFinite(judge.scores.B.total));
      assert.ok(!speech.includes("NaN"));
      assert.ok(!speech.includes("Infinity"));
    }
  });

  it("preserves valid number and numeric-string round metadata", async () => {
    const provider = new MockProvider();

    for (const { input: round, expected } of [
      { input: 2, expected: 2 },
      { input: "3", expected: 3 },
      { input: 0, expected: 0 },
      { input: "0", expected: 0 },
      { input: 42, expected: 42 }
    ]) {
      const result = await provider.generateJSON<MockJudgeResult>({
        messages: [{ role: "user", content: "hi" }],
        metadata: { round }
      });

      assert.equal(result.round, expected);
    }
  });
});
