import { canEncryptSecrets } from "@/lib/security/secrets";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
  const authConfigured = configured(process.env.AUTH_PROVIDER) || configured(process.env.AUTH_SECRET);
  const stripeConfigured =
    configured(process.env.STRIPE_SECRET_KEY) &&
    configured(process.env.STRIPE_WEBHOOK_SECRET) &&
    configured(process.env.STRIPE_PRICE_PRO_MONTHLY) &&
    configured(process.env.STRIPE_PRICE_STUDIO_MONTHLY);
  const monitoringConfigured =
    configured(process.env.SENTRY_DSN) || configured(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const blockers = [
    !authConfigured ? "真实认证未配置，demo-user 只能用于本地或演示环境。" : null,
    !canEncryptSecrets() ? "API_KEY_ENCRYPTION_SECRET 未配置，真实 Provider Key 不能安全保存。" : null,
    !stripeConfigured ? "Stripe 价格、密钥或 webhook 未完整配置。" : null,
    !monitoringConfigured ? "生产监控未配置，缺少错误率、延迟和成本告警入口。" : null,
  ].filter(Boolean);

  return Response.json({
    ok: true,
    app: "debate-theater",
    mockMode: true,
    secretEncryptionConfigured: canEncryptSecrets(),
    productionReady: blockers.length === 0,
    checks: {
      authConfigured,
      stripeConfigured,
      monitoringConfigured,
    },
    blockers,
    timestamp: new Date().toISOString(),
  });
}
