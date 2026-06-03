import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedProviderBaseUrl,
  isHttpProviderBaseUrl,
  isPrivateProviderHost,
  normalizeProviderBaseUrl,
  providerBaseUrlSchema,
} from "./provider-url.ts";

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("provider base URL helpers", () => {
  it("accepts http and https URLs", () => {
    assert.equal(isHttpProviderBaseUrl("http://localhost:3000"), true);
    assert.equal(isHttpProviderBaseUrl("https://api.openai.com/v1"), true);
  });

  it("rejects non-http schemes and malformed URLs", () => {
    for (const value of [
      "ftp://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain,hello",
      "not-a-url",
      "",
    ]) {
      assert.equal(isHttpProviderBaseUrl(value), false);
    }
  });

  it("normalizes allowlisted HTTPS URLs and rejects invalid values", () => {
    const originalAllowlist = process.env.PROVIDER_BASE_URL_ALLOWLIST;
    try {
      process.env.PROVIDER_BASE_URL_ALLOWLIST = "api.example.com";
      assert.equal(normalizeProviderBaseUrl(" https://api.example.com/v1/// "), "https://api.example.com/v1");
    } finally {
      setEnv("PROVIDER_BASE_URL_ALLOWLIST", originalAllowlist);
    }

    assert.equal(normalizeProviderBaseUrl(""), null);
    assert.equal(normalizeProviderBaseUrl(null), null);
    assert.equal(normalizeProviderBaseUrl("ftp://example.com"), null);
  });

  it("blocks localhost, loopback, RFC1918, link-local, and metadata targets by default", () => {
    for (const value of [
      "http://localhost:11434",
      "https://127.0.0.1/v1",
      "https://10.0.0.5/v1",
      "https://172.16.0.8/v1",
      "https://192.168.1.20/v1",
      "https://169.254.169.254/latest/meta-data",
      "https://metadata.google.internal/v1",
      "https://[::1]/v1",
      "https://[fe80::1]/v1",
      "https://[::ffff:127.0.0.1]/v1",
    ]) {
      assert.equal(isPrivateProviderHost(value), true);
      assert.equal(isAllowedProviderBaseUrl(value), false);
      assert.equal(normalizeProviderBaseUrl(value), null);
    }
  });

  it("allows local provider URLs only behind the development escape hatch", () => {
    const originalAllowLocal = process.env.ALLOW_LOCAL_PROVIDER_URLS;
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      setEnv("NODE_ENV", "development");
      process.env.ALLOW_LOCAL_PROVIDER_URLS = "true";
      assert.equal(normalizeProviderBaseUrl("http://localhost:11434/"), "http://localhost:11434");

      setEnv("NODE_ENV", "production");
      assert.equal(normalizeProviderBaseUrl("http://localhost:11434/"), null);
    } finally {
      setEnv("ALLOW_LOCAL_PROVIDER_URLS", originalAllowLocal);
      setEnv("NODE_ENV", originalNodeEnv);
    }
  });

  it("schema accepts optional and empty values", () => {
    assert.equal(providerBaseUrlSchema.parse(undefined), undefined);
    assert.equal(providerBaseUrlSchema.parse(""), "");
    assert.equal(providerBaseUrlSchema.parse("   "), "");
  });

  it("schema accepts and normalizes allowlisted HTTPS URLs", () => {
    const originalAllowlist = process.env.PROVIDER_BASE_URL_ALLOWLIST;
    try {
      process.env.PROVIDER_BASE_URL_ALLOWLIST = "api.example.com";
      assert.equal(providerBaseUrlSchema.parse("https://api.example.com/v1///"), "https://api.example.com/v1");
    } finally {
      setEnv("PROVIDER_BASE_URL_ALLOWLIST", originalAllowlist);
    }
  });

  it("schema rejects unsafe or malformed URLs", () => {
    for (const value of [
      "ftp://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain,hello",
      "not-a-url",
      "http://localhost:3000",
      "https://169.254.169.254/latest/meta-data",
    ]) {
      assert.throws(() => providerBaseUrlSchema.parse(value));
    }
  });
});
