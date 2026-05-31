import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveBillingMode } from "./service.ts";

describe("resolveBillingMode", () => {
  it("defaults missing, null, blank, and whitespace-only values to mock", () => {
    for (const value of [undefined, null, "", "   ", "\t", "\n", "  \r\n  ", "\t  \n\t"]) {
      assert.equal(resolveBillingMode(value), "mock", `value=${JSON.stringify(value)}`);
    }
  });

  it("trims leading and trailing whitespace from configured values", () => {
    assert.equal(resolveBillingMode("live"), "live");
    assert.equal(resolveBillingMode("  live  "), "live");
    assert.equal(resolveBillingMode("\tmock\n"), "mock");
    assert.equal(resolveBillingMode("  stripe  \t"), "stripe");
    assert.equal(resolveBillingMode("  PROD_ENV  "), "PROD_ENV");
  });

  it("preserves non-empty trimmed values including falsy-like strings", () => {
    assert.equal(resolveBillingMode("0"), "0");
    assert.equal(resolveBillingMode("false"), "false");
    assert.equal(resolveBillingMode("  off  "), "off");
  });
});
