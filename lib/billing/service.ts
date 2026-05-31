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

function nextMonthStart() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function upgradeRecommendation(params: {
  planId: string;
  remainingRounds: number;
  monthlyRoundLimit: number;
}) {
  if (params.planId === "free" && params.remainingRounds <= 0) {
    return {
      tone: "blocked",
      message: "本月免费回合已用完。升级 Pro 可继续使用真实模型、多场复盘和导出。",
      suggestedPlanId: "pro",
    };
  }

  if (params.planId === "free" && params.remainingRounds <= Math.max(10, Math.floor(params.monthlyRoundLimit * 0.2))) {
    return {
      tone: "warning",
      message: "免费额度即将用完。若要做长辩论或连续复盘，建议升级 Pro。",
      suggestedPlanId: "pro",
    };
  }

  if (params.planId === "pro" && params.remainingRounds <= 100) {
    return {
      tone: "warning",
      message: "Pro 额度接近上限。团队研究流可考虑 Studio。",
      suggestedPlanId: "studio",
    };
  }

  return {
    tone: "healthy",
    message: "额度充足。可先用 mock 跑完整路径，再接入真实模型。",
    suggestedPlanId: params.planId === "studio" ? "studio" : "pro",
  };
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
  const usageRatio = plan.monthlyRoundLimit > 0 ? usedRounds / plan.monthlyRoundLimit : 1;

  return {
    plan,
    subscriptionStatus: subscription?.status ?? "mock_active",
    subscriptionId: subscription?.id ?? null,
    usedRounds,
    remainingRounds,
    canRunRound: remainingRounds > 0,
    monthlyResetAt: nextMonthStart().toISOString(),
    usageRatio,
    upgradeRecommendation: upgradeRecommendation({
      planId: plan.id,
      remainingRounds,
      monthlyRoundLimit: plan.monthlyRoundLimit,
    }),
    upgradeScenarios: [
      "真实模型接入",
      "多场复盘沉淀",
      "Markdown / JSON 导出",
      "团队研究流",
    ],
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
