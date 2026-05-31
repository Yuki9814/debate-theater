import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPlan, parseFreeRoundLimit, validatePaidPlan } from "./plans.ts";

describe("parseFreeRoundLimit", () => {
  it("defaults missing, blank, invalid, zero, negative, and sub-1 values", () => {
    for (const value of [
      undefined,
      "",
      "   ",
      "not-a-number",
      "100px",
      "NaN",
      "0",
      "-1",
      "-50",
      "0.9",
      "0.1",
    ]) {
      assert.equal(parseFreeRoundLimit(value), 120, `value=${JSON.stringify(value)}`);
    }
  });

  it("accepts positive values and floors fractions", () => {
    assert.equal(parseFreeRoundLimit("1"), 1);
    assert.equal(parseFreeRoundLimit("1.5"), 1);
    assert.equal(parseFreeRoundLimit("120.9"), 120);
    assert.equal(parseFreeRoundLimit(" 500 "), 500);
  });
});

describe("billing plans", () => {
  it("defaults to free plan for unknown plan ids", () => {
    assert.equal(getPlan("unknown-plan").id, "free");
  });

  it("returns configured plans by id", () => {
    assert.equal(getPlan("pro").id, "pro");
    assert.equal(getPlan("studio").id, "studio");
  });
});

describe("validatePaidPlan", () => {
  it("accepts paid plan ids", () => {
    assert.equal(validatePaidPlan("pro"), "pro");
    assert.equal(validatePaidPlan("studio"), "studio");
    assert.equal(validatePaidPlan(" studio "), "studio");
  });

  it("defaults missing, empty, free, and unknown metadata to pro", () => {
    assert.equal(validatePaidPlan(null), "pro");
    assert.equal(validatePaidPlan(undefined), "pro");
    assert.equal(validatePaidPlan(""), "pro");
    assert.equal(validatePaidPlan("free"), "pro");
    assert.equal(validatePaidPlan("unknown"), "pro");
  });

  it("defaults non-string runtime metadata values to pro", () => {
    for (const value of [123, true, false, {}, []]) {
      assert.equal(validatePaidPlan(value), "pro", `value=${String(value)}`);
    }
  });
});
