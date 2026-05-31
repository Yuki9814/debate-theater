"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, CreditCard, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  price: string;
  limit: string;
  features: string[];
  isPopular?: boolean;
};

type EntitlementsResponse = {
  entitlement?: {
    plan?: {
      id?: string;
    };
  };
};

const plans: Plan[] = [
  {
    id: "free",
    name: "Free Theater",
    price: "$0",
    limit: "120 rounds/mo",
    features: ["Mock mode", "Free Debate Arena", "Local history"],
  },
  {
    id: "pro",
    name: "Pro Debater",
    price: "$12",
    limit: "1200 rounds/mo",
    features: ["Higher monthly rounds", "Premium providers", "Export-ready history"],
    isPopular: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: "$39",
    limit: "6000 rounds/mo",
    features: ["Team-ready limits", "Research debates", "Commercial use"],
  },
];

export function BillingPanel() {
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/entitlements")
      .then((res) => res.json())
      .then((data) => {
        setEntitlements(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch entitlements:", err);
        setLoading(false);
      });
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") return;

    setCheckoutLoading(planId);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (data.checkout?.url) {
        window.location.assign(data.checkout.url);
      } else {
        throw new Error(data.error || "支付通道未配置，仍可使用本地 Mock 模式");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "请求失败";
      setError(message);
      setCheckoutLoading(null);
    }
  };

  const currentPlanId = entitlements?.entitlement?.plan?.id || "free";

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--line)] bg-white/50">
            <CreditCard className="h-5 w-5 text-[var(--cinnabar)]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-[var(--ink)]">算力方案</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">订阅状态与月度回合额度</p>
          </div>
        </div>

        {loading ? (
          <Badge tone="neutral">
            <Loader2 className="h-3 w-3 animate-spin" />
            同步中
          </Badge>
        ) : (
          <Badge tone="emerald">{plans.find((plan) => plan.id === currentPlanId)?.name || "Active"}</Badge>
        )}
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isProOrStudio = plan.id !== "free";

          return (
            <article
              className={cn(
                "rounded-md border p-5 transition",
                plan.isPopular
                  ? "border-[var(--cinnabar)] bg-[var(--cinnabar-soft)]/45"
                  : "border-[var(--line)] bg-white/35 hover:bg-white/60",
              )}
              key={plan.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">{plan.name}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="font-serif text-3xl font-black text-[var(--ink)]">{plan.price}</span>
                    <span className="pb-1 text-xs text-[var(--muted)]">/mo</span>
                  </div>
                </div>
                {isCurrent ? <Badge tone="neutral">当前</Badge> : plan.isPopular ? <Badge tone="rose">推荐</Badge> : null}
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--jade)]">
                <Zap className="h-3.5 w-3.5" />
                {plan.limit}
              </div>

              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]" key={feature}>
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--jade)]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full"
                disabled={isCurrent || checkoutLoading === plan.id}
                onClick={() => handleUpgrade(plan.id)}
                size="sm"
                variant={plan.isPopular ? "primary" : "secondary"}
              >
                {checkoutLoading === plan.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  "正在使用"
                ) : isProOrStudio ? (
                  "升级"
                ) : (
                  "Free"
                )}
              </Button>
            </article>
          );
        })}
      </div>

      {error ? (
        <div className="mx-5 mb-5 flex items-center gap-3 rounded-md border border-[var(--rose)]/30 bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)] sm:mx-6 sm:mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}
    </Panel>
  );
}
