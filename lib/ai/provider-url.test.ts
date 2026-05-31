import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isHttpProviderBaseUrl,
  normalizeProviderBaseUrl,
  providerBaseUrlSchema,
} from "./provider-url.ts";

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

  it("normalizes safe base URLs and rejects invalid values", () => {
    assert.equal(normalizeProviderBaseUrl(" https://api.example.com/v1/// "), "https://api.example.com/v1");
    assert.equal(normalizeProviderBaseUrl("http://localhost:11434/"), "http://localhost:11434");
    assert.equal(normalizeProviderBaseUrl(""), null);
    assert.equal(normalizeProviderBaseUrl(null), null);
    assert.equal(normalizeProviderBaseUrl("ftp://example.com"), null);
  });

  it("schema accepts optional and empty values", () => {
    assert.equal(providerBaseUrlSchema.parse(undefined), undefined);
    assert.equal(providerBaseUrlSchema.parse(""), "");
    assert.equal(providerBaseUrlSchema.parse("   "), "");
  });

  it("schema accepts and normalizes http and https URLs", () => {
    assert.equal(providerBaseUrlSchema.parse("https://api.example.com/v1///"), "https://api.example.com/v1");
    assert.equal(providerBaseUrlSchema.parse(" http://localhost:3000 "), "http://localhost:3000");
  });

  it("schema rejects unsafe or malformed URLs", () => {
    for (const value of [
      "ftp://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain,hello",
      "not-a-url",
    ]) {
      assert.throws(() => providerBaseUrlSchema.parse(value));
    }
  });
});
