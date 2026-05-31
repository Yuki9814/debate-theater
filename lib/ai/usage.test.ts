import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateUsage, aggregateUsage } from "./usage.ts";
import { estimateProviderCostUsd } from "./cost.ts";

const pricingEnvKeys = [
  "OPENAI_INPUT_COST_PER_1K_USD",
  "OPENAI_OUTPUT_COST_PER_1K_USD",
  "CUSTOM_OPENAI_INPUT_COST_PER_1K_USD",
  "CUSTOM_OPENAI_OUTPUT_COST_PER_1K_USD"
] as const;

function withPricingEnv(values: Partial<Record<(typeof pricingEnvKeys)[number], string>>, run: () => void) {
  const originals = Object.fromEntries(pricingEnvKeys.map((key) => [key, process.env[key]]));

  for (const key of pricingEnvKeys) {
    if (Object.hasOwn(values, key)) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    run();
  } finally {
    for (const key of pricingEnvKeys) {
      const original = originals[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  }
}

describe("usage tracking logic", () => {
  it("calculates usage correctly for a single call", () => {
    const messages = [
      { role: "system" as const, content: "Hello" },
      { role: "user" as const, content: "World" },
    ];
    const outputContent = "This is a response.";

    // estimateTokens is length / 3.2
    // input: 5 + 5 + 1 (newline) = 11 chars. 11 / 3.2 = 3.43 -> 4 tokens
    // output: 19 chars. 19 / 3.2 = 5.9 -> 6 tokens

    const usage = calculateUsage({
      providerId: "mock",
      messages,
      outputContent,
    });

    assert.strictEqual(usage.inputTokens, 4);
    assert.strictEqual(usage.outputTokens, 6);
    assert.strictEqual(usage.estimatedCostUsd, 0); // mock is 0
  });

  it("aggregates multiple usage results", () => {
    const results = [
      { inputTokens: 10, outputTokens: 20, estimatedCostUsd: 0.001 },
      { inputTokens: 5, outputTokens: 15, estimatedCostUsd: 0.0005 },
    ];

    const aggregated = aggregateUsage(results);

    assert.strictEqual(aggregated.inputTokens, 15);
    assert.strictEqual(aggregated.outputTokens, 35);
    assert.strictEqual(aggregated.estimatedCostUsd, 0.0015);
  });

  it("normalizes invalid, negative, NaN, Infinity, and fractional inputs before summing", () => {
    const results = [
      { inputTokens: -10, outputTokens: 20.9, estimatedCostUsd: -0.001 },
      { inputTokens: NaN, outputTokens: Infinity, estimatedCostUsd: 0.0005 },
      { inputTokens: 3, outputTokens: 0, estimatedCostUsd: 0.0001 },
    ];

    const aggregated = aggregateUsage(results);

    assert.strictEqual(aggregated.inputTokens, 3);
    assert.strictEqual(aggregated.outputTokens, 20);
    assert.strictEqual(aggregated.estimatedCostUsd, 0.0006);
  });

  it("returns zero result when all inputs are malformed", () => {
    const aggregated = aggregateUsage([
      { inputTokens: NaN, outputTokens: -5, estimatedCostUsd: Infinity },
      { inputTokens: -Infinity, outputTokens: NaN, estimatedCostUsd: "not-a-number" as unknown as number },
    ]);

    assert.strictEqual(aggregated.inputTokens, 0);
    assert.strictEqual(aggregated.outputTokens, 0);
    assert.strictEqual(aggregated.estimatedCostUsd, 0);
  });
});

describe("pricing env config", () => {
  it("defaults missing pricing values to zero", () => {
    withPricingEnv({}, () => {
      assert.strictEqual(estimateProviderCostUsd({ providerId: "openai", inputTokens: 1000, outputTokens: 1000 }), 0);
      assert.strictEqual(
        estimateProviderCostUsd({ providerId: "custom-openai", inputTokens: 1000, outputTokens: 1000 }),
        0
      );
    });
  });

  it("treats blank, invalid, and negative pricing values as zero", () => {
    for (const value of ["", "   ", "not-a-number", "NaN", "-0.002", "-1"]) {
      withPricingEnv(
        {
          OPENAI_INPUT_COST_PER_1K_USD: value,
          OPENAI_OUTPUT_COST_PER_1K_USD: value,
          CUSTOM_OPENAI_INPUT_COST_PER_1K_USD: value,
          CUSTOM_OPENAI_OUTPUT_COST_PER_1K_USD: value
        },
        () => {
          assert.strictEqual(
            estimateProviderCostUsd({ providerId: "openai", inputTokens: 1000, outputTokens: 1000 }),
            0,
            `openai pricing=${JSON.stringify(value)}`
          );
          assert.strictEqual(
            estimateProviderCostUsd({ providerId: "custom-openai", inputTokens: 1000, outputTokens: 1000 }),
            0,
            `custom pricing=${JSON.stringify(value)}`
          );
        }
      );
    }
  });

  it("accepts zero, fractional, and integer positive pricing values", () => {
    withPricingEnv(
      {
        OPENAI_INPUT_COST_PER_1K_USD: "0.0015",
        OPENAI_OUTPUT_COST_PER_1K_USD: "0.003",
        CUSTOM_OPENAI_INPUT_COST_PER_1K_USD: "0",
        CUSTOM_OPENAI_OUTPUT_COST_PER_1K_USD: "1.25"
      },
      () => {
        assert.strictEqual(estimateProviderCostUsd({ providerId: "openai", inputTokens: 1000, outputTokens: 2000 }), 0.0075);
        assert.strictEqual(
          estimateProviderCostUsd({ providerId: "custom-openai", inputTokens: 1000, outputTokens: 2000 }),
          2.5
        );
      }
    );
  });

  it("keeps mock provider cost at zero regardless of pricing env values", () => {
    withPricingEnv(
      {
        OPENAI_INPUT_COST_PER_1K_USD: "9.99",
        OPENAI_OUTPUT_COST_PER_1K_USD: "9.99",
        CUSTOM_OPENAI_INPUT_COST_PER_1K_USD: "9.99",
        CUSTOM_OPENAI_OUTPUT_COST_PER_1K_USD: "9.99"
      },
      () => {
        assert.strictEqual(estimateProviderCostUsd({ providerId: "mock", inputTokens: 100000, outputTokens: 100000 }), 0);
        assert.strictEqual(
          calculateUsage({
            providerId: "mock",
            messages: [{ role: "user", content: "hello" }],
            outputContent: "world"
          }).estimatedCostUsd,
          0
        );
      }
    );
  });
});

describe("estimateProviderCostUsd token normalization", () => {
  it("normalizes invalid, negative, and fractional token counts before calculating cost", () => {
    withPricingEnv(
      {
        OPENAI_INPUT_COST_PER_1K_USD: "0.002",
        OPENAI_OUTPUT_COST_PER_1K_USD: "0.006"
      },
      () => {
        assert.strictEqual(
          estimateProviderCostUsd({ providerId: "openai", inputTokens: -500, outputTokens: -200 }),
          0
        );
        assert.strictEqual(
          estimateProviderCostUsd({ providerId: "openai", inputTokens: NaN, outputTokens: Infinity }),
          0
        );
        assert.strictEqual(
          estimateProviderCostUsd({ providerId: "openai", inputTokens: 1500.9, outputTokens: 0.1 }),
          0.003
        );
        assert.strictEqual(
          estimateProviderCostUsd({ providerId: "openai", inputTokens: 1000, outputTokens: 500 }),
          0.005
        );
      }
    );
  });
});
