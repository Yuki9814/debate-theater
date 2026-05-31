export type BillingPlan = {
  id: "free" | "pro" | "studio";
  name: string;
  monthlyPriceUsd: number;
  monthlyRoundLimit: number;
  features: string[];
};

const DEFAULT_FREE_ROUND_LIMIT = 120;

export function parseFreeRoundLimit(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_FREE_ROUND_LIMIT;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_FREE_ROUND_LIMIT;
  return Math.floor(parsed);
}

function freeRoundLimit() {
  return parseFreeRoundLimit(process.env.PLATFORM_FREE_ROUND_CREDITS);
}

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free Theater",
    monthlyPriceUsd: 0,
    monthlyRoundLimit: freeRoundLimit(),
    features: ["Mock mode", "Free Debate Arena", "Local history"],
  },
  {
    id: "pro",
    name: "Pro Debater",
    monthlyPriceUsd: 12,
    monthlyRoundLimit: 1200,
    features: ["Higher monthly rounds", "Premium providers", "Export-ready history"],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyPriceUsd: 39,
    monthlyRoundLimit: 6000,
    features: ["Team-ready limits", "Research debates", "Commercial use"],
  },
];

export function getPlan(planId = "free") {
  return billingPlans.find((plan) => plan.id === planId) ?? billingPlans[0];
}

export function validatePaidPlan(planId: unknown): "pro" | "studio" {
  if (typeof planId !== "string") return "pro";
  return planId.trim() === "studio" ? "studio" : "pro";
}
