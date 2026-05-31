import { AppError } from "../errors.ts";
import { getPlan } from "./plans.ts";
import { prisma } from "../db/prisma.ts";

export type RoundUsageInput = {
  userId: string;
  sessionId: string;
  providerId?: string | null;
  roundNumber: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

function monthStart() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function resolveBillingMode(value: string | null | undefined): string {
  if (typeof value !== "string") return "mock";
  const trimmed = value.trim();
  return trimmed || "mock";
}

export async function getBillingEntitlement(userId: string) {
  const subscription = await prisma.billingSubscription.findFirst({
    where: {
      userId,
      statusIn: ["active", "trialing", "mock_active"],
    },
  });
  const plan = getPlan(subscription?.planId ?? "free");
  const usedRounds = await prisma.usageEvent.count({
    where: {
      userId,
      eventType: "debate_round",
      createdAtGte: monthStart(),
    },
  });
  const remainingRounds = Math.max(plan.monthlyRoundLimit - usedRounds, 0);

  return {
    plan,
    subscriptionStatus: subscription?.status ?? "mock_active",
    subscriptionId: subscription?.id ?? null,
    usedRounds,
    remainingRounds,
    canRunRound: remainingRounds > 0,
    billingMode: resolveBillingMode(process.env.BILLING_MODE),
  };
}

export async function assertCanRunRound(userId: string) {
  const entitlement = await getBillingEntitlement(userId);
  if (!entitlement.canRunRound) {
    throw new AppError("本月免费回合额度已用完，请升级或配置更高额度。", 402, "ROUND_QUOTA_EXCEEDED");
  }
  return entitlement;
}

export async function recordRoundUsage(input: RoundUsageInput) {
  await prisma.usageEvent.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId,
      providerId: input.providerId ?? null,
      eventType: "debate_round",
      roundNumber: input.roundNumber,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd,
    },
  });
}
