import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "./utils.ts";

describe("formatDateTime", () => {
  it("formats valid Date objects and ISO strings", () => {
    for (const value of [new Date("2025-05-25T14:30:00"), "2025-05-25T09:05:00.000Z"]) {
      const result = formatDateTime(value);

      assert.equal(typeof result, "string");
      assert.notEqual(result, "时间未知");
      assert.ok(result.length > 0);
    }
  });

  it("returns a stable fallback for invalid dates", () => {
    for (const value of ["not-a-date", "", "2025-13-99", new Date("invalid"), new Date(NaN)]) {
      assert.equal(formatDateTime(value), "时间未知", `value=${String(value)}`);
    }
  });
});

describe("formatDate", () => {
  it("formats valid Date objects and ISO strings", () => {
    for (const value of [new Date("2025-05-25T14:30:00"), "2025-05-25T09:05:00.000Z"]) {
      const result = formatDate(value);

      assert.equal(typeof result, "string");
      assert.notEqual(result, "时间未知");
      assert.ok(result.length > 0);
    }
  });

  it("returns a stable fallback for invalid dates", () => {
    for (const value of ["not-a-date", "", new Date("bad"), new Date(NaN)]) {
      assert.equal(formatDate(value), "时间未知", `value=${String(value)}`);
    }
  });
});
