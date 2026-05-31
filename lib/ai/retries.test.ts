import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  OpenAIProvider,
  resolveAiProviderMaxRetries,
  resolveAiProviderRetryBaseDelayMs,
  resolveAiProviderTimeoutMs,
} from "./openai-provider.ts";
import { AITimeoutError } from "../errors.ts";

describe("OpenAIProvider Retries", () => {
  it("retries on 429 only when retries are explicitly enabled", async () => {
    let calls = 0;
    const mockFetch = mock.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("Rate limit exceeded", { status: 429 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Success after retry" } }]
      }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      process.env.AI_PROVIDER_MAX_RETRIES = "1";
      process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS = "0";
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      const result = await provider.generateText({
        messages: [{ role: "user", content: "hi" }]
      });

      assert.strictEqual(result, "Success after retry");
      assert.strictEqual(calls, 2);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.AI_PROVIDER_MAX_RETRIES;
      delete process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS;
    }
  });

  it("fails after maximum retries on 500 Server Error", async () => {
    let calls = 0;
    const mockFetch = mock.fn(async () => {
      calls += 1;
      return new Response("Internal Server Error", { status: 500 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      process.env.AI_PROVIDER_MAX_RETRIES = "1";
      process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS = "0";

      await assert.rejects(
        provider.generateText({ messages: [{ role: "user", content: "hi" }] }),
        { name: "AIProviderError" }
      );
      assert.strictEqual(calls, 2); // initial + 1 retry
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.AI_PROVIDER_MAX_RETRIES;
      delete process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS;
    }
  });

  it("does not retry non-retryable 400 provider errors", async () => {
    let calls = 0;
    const mockFetch = mock.fn(async () => {
      calls += 1;
      return new Response("Bad Request", { status: 400 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      process.env.AI_PROVIDER_MAX_RETRIES = "2";
      process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS = "0";
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await assert.rejects(
        provider.generateText({ messages: [{ role: "user", content: "hi" }] }),
        { name: "AIProviderError" }
      );
      assert.strictEqual(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.AI_PROVIDER_MAX_RETRIES;
      delete process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS;
    }
  });

  it("throws AITimeoutError on AbortError", async () => {
    let calls = 0;
    const mockFetch = mock.fn(async () => {
      calls += 1;
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await assert.rejects(
        provider.generateText({ messages: [{ role: "user", content: "hi" }] }),
        (err: unknown) => err instanceof AITimeoutError
      );
      assert.strictEqual(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("AI provider numeric env config", () => {
  it("defaults timeout when config is missing, blank, invalid, zero, or negative", () => {
    for (const value of [undefined, null, "", "   ", "\t\n\r", "abc", "NaN", "0", "-1"]) {
      assert.equal(resolveAiProviderTimeoutMs(value), 60_000, `value=${JSON.stringify(value)}`);
    }
  });

  it("accepts positive timeout values after trimming", () => {
    assert.equal(resolveAiProviderTimeoutMs("1"), 1);
    assert.equal(resolveAiProviderTimeoutMs(" 2500 "), 2500);
    assert.equal(resolveAiProviderTimeoutMs("1000.5"), 1000.5);
  });

  it("defaults, floors, and caps max retries", () => {
    for (const value of [undefined, null, "", "   ", "abc", "NaN", "-1"]) {
      assert.equal(resolveAiProviderMaxRetries(value), 0, `value=${JSON.stringify(value)}`);
    }

    assert.equal(resolveAiProviderMaxRetries("0"), 0);
    assert.equal(resolveAiProviderMaxRetries(" 2.9 "), 2);
    assert.equal(resolveAiProviderMaxRetries("99"), 5);
  });

  it("defaults retry base delay for missing, blank, invalid, or negative values", () => {
    for (const value of [undefined, null, "", "   ", "\t\n\r", "abc", "NaN", "-1"]) {
      assert.equal(resolveAiProviderRetryBaseDelayMs(value), 250, `value=${JSON.stringify(value)}`);
    }
  });

  it("allows explicit zero retry delay while trimming configured values", () => {
    assert.equal(resolveAiProviderRetryBaseDelayMs("0"), 0);
    assert.equal(resolveAiProviderRetryBaseDelayMs(" 0 "), 0);
    assert.equal(resolveAiProviderRetryBaseDelayMs(" 125.5 "), 125.5);
  });
});
