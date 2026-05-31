import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeWinner, sessionControlSchema } from "./types.ts";

describe("sessionControlSchema winner normalization", () => {
  it("preserves omitted and explicit null winner values", () => {
    assert.equal(sessionControlSchema.parse({ status: "paused" }).winner, undefined);
    assert.equal(sessionControlSchema.parse({ winner: null }).winner, null);
  });

  it("normalizes blank and whitespace-only winner strings to null", () => {
    for (const winner of ["", "   ", "\t\n "]) {
      assert.equal(sessionControlSchema.parse({ winner }).winner, null, `winner=${JSON.stringify(winner)}`);
    }
  });

  it("trims nonblank winner strings and still enforces max length", () => {
    assert.equal(sessionControlSchema.parse({ winner: "  Alice  " }).winner, "Alice");
    assert.equal(sessionControlSchema.parse({ winner: "x".repeat(120) }).winner, "x".repeat(120));
    assert.throws(() => {
      sessionControlSchema.parse({ winner: "x".repeat(121) });
    });
  });

  it("exposes the same normalization as a pure helper", () => {
    assert.equal(normalizeWinner(undefined), undefined);
    assert.equal(normalizeWinner(null), null);
    assert.equal(normalizeWinner(""), null);
    assert.equal(normalizeWinner("   "), null);
    assert.equal(normalizeWinner("  Bob  "), "Bob");
  });
});
