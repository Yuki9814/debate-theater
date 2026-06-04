import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectNeutralSourceCards, normalizeSourceCards, researchCredentialEnvName, sourceCollectionMode } from "./source-cards.ts";

function searchProviderEnvName() {
  return ["SEARCH", "PROVIDER"].join("_");
}

describe("research source cards", () => {
  afterEach(() => {
    delete process.env[searchProviderEnvName()];
    delete process.env[researchCredentialEnvName()];
  });

  it("normalizes valid search results and filters invalid URLs", () => {
    const cards = normalizeSourceCards("AI 标识", [
      {
        title: "Policy update",
        url: "https://example.com/policy",
        content: "A useful neutral summary.",
        published_date: "2026-05-31",
        score: 0.82,
      },
      {
        title: "Bad URL",
        url: "notaurl",
        content: "ignored",
      },
    ]);

    assert.equal(cards.length, 1);
    assert.equal(cards[0].sourceName, "example.com");
    assert.match(cards[0].reliabilityNote, /82/);
  });

  it("returns fallback cards when Tavily is not configured", async () => {
    process.env[searchProviderEnvName()] = "tavily";
    const cards = await collectNeutralSourceCards("测试热点议题");
    assert.ok(cards.length >= 1);
    assert.equal(cards[0].sourceName, "search-fallback");
    assert.equal(sourceCollectionMode(cards), "fallback");
  });

  it("marks normalized search results as live source cards", () => {
    const cards = normalizeSourceCards("AI 标识", [
      {
        title: "Policy update",
        url: "https://example.com/policy",
        content: "A useful neutral summary.",
        published_date: "2026-05-31",
        score: 0.82,
      },
    ]);

    assert.equal(sourceCollectionMode(cards), "live");
  });
});
