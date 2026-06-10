import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { consumeRateLimit, rateLimitResponse } from "./rate-limit.ts";

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("rate limiting", () => {
  const originalRateLimitBackend = process.env.RATE_LIMIT_BACKEND;
  const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.RATE_LIMIT_BACKEND;
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    setEnv("RATE_LIMIT_BACKEND", originalRateLimitBackend);
    setEnv("TRUST_PROXY_HEADERS", originalTrustProxy);
    setEnv("NODE_ENV", originalNodeEnv);
    setEnv("UPSTASH_REDIS_REST_URL", originalUpstashUrl);
    setEnv("UPSTASH_REDIS_REST_TOKEN", originalUpstashToken);
    globalThis.fetch = originalFetch;
  });

  it("allows requests within the limit", async () => {
    const request = new Request("http://localhost/api");

    const result = await consumeRateLimit("test-scope", request, {
      limit: 2,
      windowMs: 1000,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 1);
    assert.equal(result.limit, 2);
  });

  it("blocks requests exceeding the limit", async () => {
    const request = new Request("http://localhost/api");

    // First request
    await consumeRateLimit("blocked-scope", request, { limit: 1, windowMs: 1000 });

    // Second request
    const result = await consumeRateLimit("blocked-scope", request, { limit: 1, windowMs: 1000 });

    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  it("resets after the window expires", async () => {
    const request = new Request("http://localhost/api");

    const options = { limit: 1, windowMs: 10 }; // Very short window

    await consumeRateLimit("reset-scope", request, options);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    const result = await consumeRateLimit("reset-scope", request, options);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 0);
  });

  it("does not trust forged x-forwarded-for by default", async () => {
    const options = { limit: 1, windowMs: 1000 };
    const first = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const forged = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });

    await consumeRateLimit("ip-scope-untrusted", first, options);
    assert.equal((await consumeRateLimit("ip-scope-untrusted", forged, options)).allowed, false);
  });

  it("uses proxy headers only when explicitly trusted", async () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const first = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "10.0.0.1, 192.168.0.1" },
    });
    const second = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "10.0.0.2, 192.168.0.1" },
    });

    await consumeRateLimit("ip-scope-trusted", first, { limit: 1, windowMs: 1000 });
    assert.equal((await consumeRateLimit("ip-scope-trusted", second, { limit: 1, windowMs: 1000 })).allowed, true);
  });

  it("differentiates between scopes", async () => {
    const request = new Request("http://localhost/api");

    await consumeRateLimit("scope-a", request, { limit: 1, windowMs: 1000 });
    const result = await consumeRateLimit("scope-b", request, { limit: 1, windowMs: 1000 });

    assert.equal(result.allowed, true);
  });

  it("uses session cookie identity before anonymous IP buckets", async () => {
    const options = { limit: 1, windowMs: 1000 };
    const firstUser = new Request("http://localhost/api", {
      headers: { cookie: "lunheng_session=abc" },
    });
    const secondUser = new Request("http://localhost/api", {
      headers: { cookie: "lunheng_session=def" },
    });

    await consumeRateLimit("session-identity", firstUser, options);
    assert.equal((await consumeRateLimit("session-identity", secondUser, options)).allowed, true);
    assert.equal((await consumeRateLimit("session-identity", firstUser, options)).allowed, false);
  });

  it("normalizes blank, whitespace, and unknown trusted client IP headers", async () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const options = { limit: 1, windowMs: 1000 };

    const spacedRealIp = new Request("http://localhost/api", {
      headers: { "x-real-ip": " 1.1.1.1 " },
    });
    const trimmedRealIp = new Request("http://localhost/api", {
      headers: { "x-real-ip": "1.1.1.1" },
    });
    await consumeRateLimit("normalize-trim", spacedRealIp, options);
    assert.equal((await consumeRateLimit("normalize-trim", trimmedRealIp, options)).allowed, false);

    const unknownForwarded = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "unknown", "x-real-ip": "2.2.2.2" },
    });
    const realIpOnly = new Request("http://localhost/api", {
      headers: { "x-real-ip": "2.2.2.2" },
    });
    await consumeRateLimit("normalize-unknown", unknownForwarded, options);
    assert.equal((await consumeRateLimit("normalize-unknown", realIpOnly, options)).allowed, false);

    const blankHeaders = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": " ", "x-real-ip": " UNKNOWN " },
    });
    const noHeaders = new Request("http://localhost/api");
    await consumeRateLimit("normalize-local", blankHeaders, options);
    assert.equal((await consumeRateLimit("normalize-local", noHeaders, options)).allowed, false);
  });

  it("returns a 429 response with correct headers and body", async () => {
    const result = {
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: 1700000000000,
    };

    const response = rateLimitResponse(result);

    assert.equal(response.status, 429);

    const body = await response.json();
    assert.deepEqual(body, { error: "请求过快，请稍后再试。" });

    assert.equal(response.headers.get("RateLimit-Limit"), "5");
    assert.equal(response.headers.get("RateLimit-Remaining"), "0");
    assert.equal(response.headers.get("RateLimit-Reset"), "1700000000");
  });

  it("fails closed when Upstash is selected but unavailable in production", async () => {
    setEnv("NODE_ENV", "production");
    process.env.RATE_LIMIT_BACKEND = "upstash";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

    const result = await consumeRateLimit("upstash-closed", new Request("https://app.example.com/api"), {
      limit: 10,
      windowMs: 1000,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });
});
