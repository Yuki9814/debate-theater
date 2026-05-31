import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSafeCheckoutOrigin } from "./checkout-origin.ts";

describe("getSafeCheckoutOrigin", () => {
  const appOrigin = "https://app.debate-theater.test";
  const checkoutUrl = `${appOrigin}/api/billing/checkout`;

  it("returns request origin when Origin header is missing", () => {
    assert.equal(getSafeCheckoutOrigin(new Request(checkoutUrl, { method: "POST" })), appOrigin);
  });

  it("returns Origin header when it exactly matches request origin", () => {
    const request = new Request(checkoutUrl, {
      method: "POST",
      headers: { origin: appOrigin }
    });

    assert.equal(getSafeCheckoutOrigin(request), appOrigin);
  });

  it("returns request origin when Origin header is cross-origin", () => {
    const request = new Request(checkoutUrl, {
      method: "POST",
      headers: { origin: "https://attacker.test" }
    });

    assert.equal(getSafeCheckoutOrigin(request), appOrigin);
  });

  it("returns request origin when Origin header is malformed", () => {
    const request = new Request(checkoutUrl, {
      method: "POST",
      headers: { origin: "not-a-url" }
    });

    assert.equal(getSafeCheckoutOrigin(request), appOrigin);
  });

  it("returns request origin when Origin header includes a trailing slash", () => {
    const request = new Request(checkoutUrl, {
      method: "POST",
      headers: { origin: `${appOrigin}/` }
    });

    assert.equal(getSafeCheckoutOrigin(request), appOrigin);
  });

  it("returns request origin when Origin header has a different port", () => {
    const request = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { origin: "http://localhost:3001" }
    });

    assert.equal(getSafeCheckoutOrigin(request), "http://localhost:3000");
  });
});
