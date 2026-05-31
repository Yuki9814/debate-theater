import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import { createStripeCheckoutSession, getStripeWebhookSecret, normalizeStripePeriodEnd, verifyStripeSignature } from "./stripe.ts";

const stripeEnvKeys = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_STUDIO_MONTHLY", "STRIPE_WEBHOOK_SECRET"] as const;

async function withStripeEnv(values: Partial<Record<(typeof stripeEnvKeys)[number], string>>, run: () => Promise<void>) {
  const originals = Object.fromEntries(stripeEnvKeys.map((key) => [key, process.env[key]]));

  for (const key of stripeEnvKeys) {
    if (Object.hasOwn(values, key)) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    await run();
  } finally {
    for (const key of stripeEnvKeys) {
      const original = originals[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  }
}

function isAppErrorCode(code: string) {
  return (error: unknown) => error instanceof AppError && error.code === code;
}

async function requestCheckout() {
  return createStripeCheckoutSession({
    userId: "user_test",
    planId: "pro",
    origin: "https://app.example.com"
  });
}

describe("verifyStripeSignature", () => {
  it("accepts a valid Stripe-style HMAC signature", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    assert.doesNotThrow(() => {
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret);
    });
  });

  it("rejects an invalid signature", () => {
    assert.throws(() => {
      verifyStripeSignature("{}", "t=1779640000,v1=deadbeef", "whsec_test_secret");
    }, /signature/i);
  });

  it("rejects signature missing timestamp", () => {
    assert.throws(() => {
      verifyStripeSignature("{}", "v1=deadbeef", "whsec_test_secret");
    }, /invalid stripe signature/i);
  });

  it("rejects signature missing v1 value", () => {
    assert.throws(() => {
      verifyStripeSignature("{}", "t=1779640000", "whsec_test_secret");
    }, /invalid stripe signature/i);
  });

  it("rejects non-hex signatures", () => {
    assert.throws(() => {
      verifyStripeSignature("{}", "t=1779640000,v1=zzzzzzzz", "whsec_test_secret");
    }, /signature/i);
  });

  it("rejects short signatures", () => {
    assert.throws(() => {
      verifyStripeSignature("{}", "t=1779640000,v1=abc", "whsec_test_secret");
    }, /signature/i);
  });

  it("accepts valid signatures with extra unrelated fields", () => {
    const payload = JSON.stringify({ id: "evt_test" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    assert.doesNotThrow(() => {
      verifyStripeSignature(payload, `t=${timestamp},v2=unknown,v1=${signature},extra=data`, secret);
    });
  });

  it("rejects valid signatures with stale timestamps outside tolerance", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    assert.throws(() => {
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret);
    }, /timestamp|tolerance|out of range/i);
  });

  it("rejects valid signatures with future timestamps outside tolerance", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor((Date.now() + 6 * 60 * 1000) / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    assert.throws(() => {
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret);
    }, /timestamp|tolerance|out of range/i);
  });

  it("rejects non-integer timestamps without accepting numeric prefixes", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = `${Math.floor(Date.now() / 1000)}abc`;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    assert.throws(() => {
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret);
    }, /invalid stripe signature/i);
  });

  it("accepts a valid v1 when an invalid v1 appears later in the header", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const validSignature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const invalidSignature = "deadbeef".repeat(8);

    assert.doesNotThrow(() => {
      verifyStripeSignature(payload, `t=${timestamp},v1=${validSignature},v1=${invalidSignature}`, secret);
    });
  });

  it("accepts a valid v1 when an invalid v1 appears earlier in the header", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const validSignature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const invalidSignature = "deadbeef".repeat(8);

    assert.doesNotThrow(() => {
      verifyStripeSignature(payload, `t=${timestamp},v1=${invalidSignature},v1=${validSignature}`, secret);
    });
  });

  it("accepts signatures with optional whitespace around commas and equals signs", () => {
    const payload = JSON.stringify({ id: "evt_test", object: "event" });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    const headers = [
      `t=${timestamp}, v1=${signature}`,
      `t=${timestamp} ,v1=${signature}`,
      `t=${timestamp} , v1=${signature}`,
      ` t=${timestamp},v1=${signature}`,
      `t = ${timestamp}, v1 = ${signature}`,
      ` t = ${timestamp} , v1 = ${signature} `
    ];

    for (const header of headers) {
      assert.doesNotThrow(() => {
        verifyStripeSignature(payload, header, secret);
      }, `Should accept header: "${header}"`);
    }
  });
});

describe("createStripeCheckoutSession config", () => {
  it("fails fast without fetching when Stripe secret or price config is blank", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      assert.fail("Stripe fetch should not be called when checkout config is blank");
    }) as typeof fetch;

    try {
      for (const env of [
        { STRIPE_SECRET_KEY: "", STRIPE_PRICE_PRO_MONTHLY: "price_test" },
        { STRIPE_SECRET_KEY: "   \t  ", STRIPE_PRICE_PRO_MONTHLY: "price_test" },
        { STRIPE_SECRET_KEY: "sk_test", STRIPE_PRICE_PRO_MONTHLY: "" },
        { STRIPE_SECRET_KEY: "sk_test", STRIPE_PRICE_PRO_MONTHLY: "\n  " }
      ]) {
        await withStripeEnv(env, async () => {
          await assert.rejects(requestCheckout, isAppErrorCode("STRIPE_NOT_CONFIGURED"));
        });
      }

      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("trims Stripe secret and price config before creating checkout sessions", async () => {
    const calls: Array<{ input: Parameters<typeof fetch>[0]; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.test/cs_test" }), {
        status: 200
      });
    }) as typeof fetch;

    try {
      await withStripeEnv(
        {
          STRIPE_SECRET_KEY: "  sk_test_trimmed  ",
          STRIPE_PRICE_PRO_MONTHLY: "\tprice_trimmed\n"
        },
        async () => {
          const result = await requestCheckout();

          assert.deepEqual(result, {
            id: "cs_test",
            url: "https://checkout.stripe.test/cs_test"
          });
        }
      );

      assert.equal(calls.length, 1);
      assert.equal(new Headers(calls[0].init?.headers).get("Authorization"), "Bearer sk_test_trimmed");

      const body = calls[0].init?.body;
      assert.ok(body instanceof URLSearchParams);
      assert.equal(body.get("line_items[0][price]"), "price_trimmed");
      assert.equal(body.get("client_reference_id"), "user_test");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("createStripeCheckoutSession response handling", () => {
  async function withCheckoutResponse(response: Response, run: () => Promise<void>) {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    globalThis.fetch = (async () => response) as typeof fetch;
    console.error = () => {};

    try {
      await withStripeEnv(
        {
          STRIPE_SECRET_KEY: "sk_test",
          STRIPE_PRICE_PRO_MONTHLY: "price_test"
        },
        run
      );
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  }

  async function assertCheckoutFailsForResponse(response: Response) {
    await withCheckoutResponse(response, async () => {
      await assert.rejects(requestCheckout, isAppErrorCode("STRIPE_CHECKOUT_FAILED"));
    });
  }

  it("throws STRIPE_CHECKOUT_FAILED for non-JSON success or error responses", async () => {
    for (const response of [
      new Response("<!doctype html><html>not json</html>", { status: 200 }),
      new Response("Payment required", { status: 402 })
    ]) {
      await assertCheckoutFailsForResponse(response);
    }
  });

  it("throws STRIPE_CHECKOUT_FAILED for non-object JSON responses", async () => {
    for (const value of [null, [], "ok", 123]) {
      await assertCheckoutFailsForResponse(new Response(JSON.stringify(value), { status: 200 }));
    }
  });

  it("throws STRIPE_CHECKOUT_FAILED when successful responses omit valid id or url", async () => {
    const responses = [
      { id: "cs_123" },
      { url: "https://checkout.stripe.test/cs_123" },
      { id: "", url: "https://checkout.stripe.test/cs_123" },
      { id: "  ", url: "https://checkout.stripe.test/cs_123" },
      { id: "cs_123", url: "" },
      { id: "cs_123", url: "  " },
      { id: 123, url: "https://checkout.stripe.test/cs_123" },
      { id: "cs_123", url: 123 }
    ];

    for (const payload of responses) {
      await assertCheckoutFailsForResponse(new Response(JSON.stringify(payload), { status: 200 }));
    }
  });

  it("throws STRIPE_CHECKOUT_FAILED for Stripe error responses with JSON payloads", async () => {
    await assertCheckoutFailsForResponse(
      new Response(JSON.stringify({ error: { message: "Invalid price" } }), { status: 400 })
    );
  });

  it("returns id and url for valid Stripe success responses", async () => {
    await withCheckoutResponse(
      new Response(JSON.stringify({ id: "cs_valid_123", url: "https://checkout.stripe.test/session" }), {
        status: 200
      }),
      async () => {
        assert.deepEqual(await requestCheckout(), {
          id: "cs_valid_123",
          url: "https://checkout.stripe.test/session"
        });
      }
    );
  });
});

describe("getStripeWebhookSecret", () => {
  it("returns null when STRIPE_WEBHOOK_SECRET is missing, blank, or whitespace-only", async () => {
    for (const value of [undefined, "", "   ", "\t\n ", "  \r\n  "]) {
      await withStripeEnv(
        value === undefined ? {} : { STRIPE_WEBHOOK_SECRET: value },
        async () => {
          assert.equal(getStripeWebhookSecret(), null, `STRIPE_WEBHOOK_SECRET=${JSON.stringify(value)}`);
        }
      );
    }
  });

  it("trims leading and trailing whitespace from a configured webhook secret", async () => {
    await withStripeEnv(
      { STRIPE_WEBHOOK_SECRET: "  whsec_trimmed_secret  \n" },
      async () => {
        assert.equal(getStripeWebhookSecret(), "whsec_trimmed_secret");
      }
    );
  });

  it("accepts a signature generated with the normalized webhook secret", async () => {
    const payload = JSON.stringify({ id: "evt_wh", object: "event" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = "whsec_verify_trim";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

    await withStripeEnv(
      { STRIPE_WEBHOOK_SECRET: `  ${secret}  ` },
      async () => {
        assert.doesNotThrow(() => {
          verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, getStripeWebhookSecret() ?? "");
        });
      }
    );
  });
});

describe("normalizeStripePeriodEnd", () => {
  it("returns null for missing, malformed, unsafe, or invalid date values", () => {
    const values = [
      undefined,
      null,
      0,
      -1,
      0.5,
      1.1,
      NaN,
      Infinity,
      -Infinity,
      "1712345678",
      true,
      false,
      {},
      [],
      Number.MAX_SAFE_INTEGER
    ];

    for (const value of values) {
      assert.equal(normalizeStripePeriodEnd(value), null, `value=${String(value)}`);
    }
  });

  it("accepts positive safe integer epoch seconds", () => {
    const seconds = 1712345678;
    const date = normalizeStripePeriodEnd(seconds);

    assert.ok(date instanceof Date);
    assert.equal(date.getTime(), seconds * 1000);
    assert.equal(date.toISOString(), new Date(seconds * 1000).toISOString());
  });

  it("accepts the smallest positive second and a large realistic second", () => {
    assert.equal(normalizeStripePeriodEnd(1)?.toISOString(), "1970-01-01T00:00:01.000Z");

    const seconds = 2000000000;
    const date = normalizeStripePeriodEnd(seconds);

    assert.ok(date instanceof Date);
    assert.equal(date.getTime(), seconds * 1000);
  });
});
