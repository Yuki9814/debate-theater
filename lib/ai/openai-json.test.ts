import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CustomOpenAICompatibleProvider, OpenAIProvider } from "./openai-provider.ts";
import { AIAuthenticationError, AIProviderError } from "../errors.ts";

function parseBody(init?: RequestInit): Record<string, unknown> {
  const body = init?.body;
  if (typeof body !== "string") {
    assert.fail("fetch was called without a string body");
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function requireBody(body: Record<string, unknown> | null): Record<string, unknown> {
  assert.ok(body);
  return body;
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function captureRequestModel(provider: OpenAIProvider, inputModel?: string | null) {
  let capturedBody: Record<string, unknown> | null = null;
  const mockFetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = parseBody(init);
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as unknown as typeof fetch;

  try {
    const input: { messages: { role: "user"; content: string }[]; model?: string | null } = {
      messages: [{ role: "user", content: "hi" }]
    };
    if (inputModel !== undefined) {
      input.model = inputModel;
    }

    await provider.generateText(input);
    return requireBody(capturedBody).model;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe("OpenAIProvider JSON mode and parsing", () => {
  it("generateJSON sends JSON response_format in the request body", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const mockFetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = parseBody(init);
      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await provider.generateJSON({ messages: [{ role: "user", content: "return json" }] });

      const body = requireBody(capturedBody);
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(typeof body.model, "string");
      assert.ok(Array.isArray(body.messages));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("generateText omits response_format from the request body", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const mockFetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = parseBody(init);
      return new Response(JSON.stringify({ choices: [{ message: { content: "plain response" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await provider.generateText({ messages: [{ role: "user", content: "hello" }] });

      assert.equal(Object.hasOwn(requireBody(capturedBody), "response_format"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("generateJSON parses plain JSON content from provider", async () => {
    const mockFetch = mock.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"score\":87,\"label\":\"good\"}" } }] }), {
        status: 200
      });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      const result = await provider.generateJSON<{ score: number; label: string }>({
        messages: [{ role: "user", content: "json please" }]
      });

      assert.deepEqual(result, { score: 87, label: "good" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("generateJSON parses fenced json content from provider", async () => {
    const mockFetch = mock.fn(async () => {
      const fenced = "```json\n{\n  \"nested\": { \"a\": 1 },\n  \"list\": [true, false]\n}\n```";
      return new Response(JSON.stringify({ choices: [{ message: { content: fenced } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      const result = await provider.generateJSON<{ nested: { a: number }; list: boolean[] }>({
        messages: [{ role: "user", content: "json" }]
      });

      assert.deepEqual(result, { nested: { a: 1 }, list: [true, false] });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("generateJSON parses fenced content without a language tag", async () => {
    const mockFetch = mock.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "```\n{\"bare\":\"fence\"}\n```" } }] }), {
        status: 200
      });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      const result = await provider.generateJSON<{ bare: string }>({
        messages: [{ role: "user", content: "json" }]
      });

      assert.deepEqual(result, { bare: "fence" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses normalized custom base URL without duplicate slashes", async () => {
    let capturedUrl: string | undefined;
    const mockFetch = mock.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({
        apiKey: "test-key",
        baseUrl: "https://api.example.com/v1///"
      });
      await provider.generateText({ messages: [{ role: "user", content: "hi" }] });

      assert.equal(capturedUrl, "https://api.example.com/v1/chat/completions");
      assert.equal(capturedUrl.includes("//chat"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to the default HTTPS base URL for invalid baseUrl", async () => {
    let capturedUrl: string | undefined;
    const mockFetch = mock.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({
        apiKey: "test-key",
        baseUrl: "ftp://example.com"
      });
      await provider.generateJSON<{ ok: boolean }>({ messages: [{ role: "user", content: "json" }] });

      assert.equal(capturedUrl, "https://api.openai.com/v1/chat/completions");
      assert.equal(capturedUrl.startsWith("ftp:"), false);
      assert.equal(capturedUrl.startsWith("file:"), false);
      assert.equal(capturedUrl.startsWith("javascript:"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserves default base URL behavior when no baseUrl option or env override is set", async () => {
    const originalBaseUrl = process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;

    let capturedUrl: string | undefined;
    const mockFetch = mock.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ choices: [{ message: { content: "plain response" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await provider.generateText({ messages: [{ role: "user", content: "hello" }] });

      assert.equal(capturedUrl, "https://api.openai.com/v1/chat/completions");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalBaseUrl === undefined) {
        delete process.env.OPENAI_BASE_URL;
      } else {
        process.env.OPENAI_BASE_URL = originalBaseUrl;
      }
    }
  });

  it("generateJSON throws AIProviderError on malformed JSON content from provider", async () => {
    const mockFetch = mock.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "not valid json" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await assert.rejects(
        provider.generateJSON({ messages: [{ role: "user", content: "json" }] }),
        (err: unknown) => err instanceof AIProviderError && /malformed JSON content/.test((err as Error).message)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies 200 responses with non-string content as empty responses", async () => {
    const mockFetch = mock.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: { foo: "bar" } } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await assert.rejects(
        provider.generateText({ messages: [{ role: "user", content: "hi" }] }),
        (err: unknown) => err instanceof AIProviderError && /empty response/.test((err as Error).message)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies 200 responses with whitespace-only content as empty responses", async () => {
    const mockFetch = mock.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "  \n\t  " } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await assert.rejects(
        provider.generateText({ messages: [{ role: "user", content: "hi" }] }),
        (err: unknown) => err instanceof AIProviderError && /empty response/.test((err as Error).message)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies non-string JSON-mode content without throwing raw TypeError", async () => {
    const mockFetch = mock.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test-key" });
      await assert.rejects(
        provider.generateJSON({ messages: [{ role: "user", content: "json" }] }),
        (err: unknown) => err instanceof AIProviderError && /empty response/.test((err as Error).message)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("OpenAIProvider model normalization", () => {
  it("falls back to the default model when OPENAI_DEFAULT_MODEL is blank", async () => {
    const originalModel = process.env.OPENAI_DEFAULT_MODEL;

    try {
      process.env.OPENAI_DEFAULT_MODEL = "   \t  ";

      assert.equal(await captureRequestModel(new OpenAIProvider({ apiKey: "test-key" })), "gpt-4.1-mini");
    } finally {
      setEnv("OPENAI_DEFAULT_MODEL", originalModel);
    }
  });

  it("trims configured OpenAI model values", async () => {
    const originalModel = process.env.OPENAI_DEFAULT_MODEL;

    try {
      process.env.OPENAI_DEFAULT_MODEL = "  gpt-4-turbo  ";

      assert.equal(await captureRequestModel(new OpenAIProvider({ apiKey: "test-key" })), "gpt-4-turbo");
      assert.equal(
        await captureRequestModel(new OpenAIProvider({ apiKey: "test-key", defaultModel: "  gpt-4o-mini  " })),
        "gpt-4o-mini"
      );
    } finally {
      setEnv("OPENAI_DEFAULT_MODEL", originalModel);
    }
  });

  it("normalizes custom OpenAI default model values", async () => {
    const originalOpenAIModel = process.env.OPENAI_DEFAULT_MODEL;
    const originalCustomModel = process.env.CUSTOM_OPENAI_DEFAULT_MODEL;

    try {
      delete process.env.OPENAI_DEFAULT_MODEL;
      process.env.CUSTOM_OPENAI_DEFAULT_MODEL = "  ";

      assert.equal(
        await captureRequestModel(new CustomOpenAICompatibleProvider({ apiKey: "test-key", baseUrl: "https://custom.example/v1" })),
        "gpt-4.1-mini"
      );

      process.env.CUSTOM_OPENAI_DEFAULT_MODEL = "  custom-model  ";

      assert.equal(
        await captureRequestModel(new CustomOpenAICompatibleProvider({ apiKey: "test-key", baseUrl: "https://custom.example/v1" })),
        "custom-model"
      );
    } finally {
      setEnv("OPENAI_DEFAULT_MODEL", originalOpenAIModel);
      setEnv("CUSTOM_OPENAI_DEFAULT_MODEL", originalCustomModel);
    }
  });

  it("falls back to the configured default when request model is blank", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key", defaultModel: "  configured-default  " });

    assert.equal(await captureRequestModel(provider, ""), "configured-default");
    assert.equal(await captureRequestModel(provider, "   \t  "), "configured-default");
  });

  it("trims valid request model overrides", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key", defaultModel: "gpt-4.1-mini" });

    assert.equal(await captureRequestModel(provider, "  gpt-4o  "), "gpt-4o");
    assert.equal(await captureRequestModel(provider, "custom-override"), "custom-override");
    assert.equal(await captureRequestModel(provider), "gpt-4.1-mini");
  });
});

describe("OpenAIProvider API key normalization", () => {
  it("rejects blank API keys without calling fetch", async () => {
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalCustomKey = process.env.CUSTOM_OPENAI_API_KEY;
    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async () => {
      assert.fail("fetch should not be called when API key is blank");
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      process.env.OPENAI_API_KEY = "   ";
      process.env.CUSTOM_OPENAI_API_KEY = "\t\n  ";

      const providers = [
        new OpenAIProvider({}),
        new OpenAIProvider({ apiKey: "" }),
        new OpenAIProvider({ apiKey: "  \t " }),
        new CustomOpenAICompatibleProvider({ baseUrl: "https://custom.example/v1" }),
        new CustomOpenAICompatibleProvider({ apiKey: "   ", baseUrl: "https://custom.example/v1" })
      ];

      for (const provider of providers) {
        await assert.rejects(
          provider.generateText({ messages: [{ role: "user", content: "hi" }] }),
          (error: unknown) => error instanceof AIAuthenticationError
        );
      }

      assert.equal(mockFetch.mock.calls.length, 0);
    } finally {
      globalThis.fetch = originalFetch;
      setEnv("OPENAI_API_KEY", originalOpenAIKey);
      setEnv("CUSTOM_OPENAI_API_KEY", originalCustomKey);
    }
  });

  it("trims API key options before sending Authorization headers", async () => {
    const capturedAuth: string[] = [];
    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      capturedAuth.push(headers.Authorization);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      await new OpenAIProvider({ apiKey: "  sk-test-123   \n" }).generateText({
        messages: [{ role: "user", content: "hi" }]
      });
      await new CustomOpenAICompatibleProvider({
        apiKey: "\t sk-custom-xyz \t",
        baseUrl: "https://custom.example/v1"
      }).generateText({ messages: [{ role: "user", content: "hi" }] });

      assert.deepEqual(capturedAuth, ["Bearer sk-test-123", "Bearer sk-custom-xyz"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("trims API key env vars before sending Authorization headers", async () => {
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalCustomKey = process.env.CUSTOM_OPENAI_API_KEY;
    const capturedAuth: string[] = [];
    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      capturedAuth.push(headers.Authorization);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      process.env.OPENAI_API_KEY = "  env-openai-key  ";
      process.env.CUSTOM_OPENAI_API_KEY = "\n custom-env-key \t";

      await new OpenAIProvider({}).generateText({ messages: [{ role: "user", content: "hi" }] });
      await new CustomOpenAICompatibleProvider({ baseUrl: "https://custom.example/v1" }).generateText({
        messages: [{ role: "user", content: "hi" }]
      });

      assert.deepEqual(capturedAuth, ["Bearer env-openai-key", "Bearer custom-env-key"]);
    } finally {
      globalThis.fetch = originalFetch;
      setEnv("OPENAI_API_KEY", originalOpenAIKey);
      setEnv("CUSTOM_OPENAI_API_KEY", originalCustomKey);
    }
  });
});

describe("OpenAIProvider temperature normalization", () => {
  async function captureRequestTemperature(
    provider: OpenAIProvider,
    inputTemperature?: number
  ): Promise<unknown> {
    let capturedBody: Record<string, unknown> | null = null;
    const mockFetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = parseBody(init);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const input: { messages: { role: "user"; content: string }[]; temperature?: number } = {
        messages: [{ role: "user", content: "hi" }]
      };
      if (inputTemperature !== undefined) {
        input.temperature = inputTemperature;
      }

      await provider.generateText(input);
      return requireBody(capturedBody).temperature;
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  it("defaults to 0.7 when temperature is omitted", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    assert.equal(await captureRequestTemperature(provider), 0.7);
    assert.equal(await captureRequestTemperature(provider, undefined), 0.7);
  });

  it("preserves explicit finite temperatures including zero", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    assert.equal(await captureRequestTemperature(provider, 0), 0);
    assert.equal(await captureRequestTemperature(provider, 0.2), 0.2);
    assert.equal(await captureRequestTemperature(provider, 1), 1);
    assert.equal(await captureRequestTemperature(provider, 2), 2);
    assert.equal(await captureRequestTemperature(provider, 1.5), 1.5);
  });

  it("falls back to 0.7 for non-finite numbers at runtime", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    assert.equal(await captureRequestTemperature(provider, NaN), 0.7);
    assert.equal(await captureRequestTemperature(provider, Infinity), 0.7);
    assert.equal(await captureRequestTemperature(provider, -Infinity), 0.7);
  });
});
