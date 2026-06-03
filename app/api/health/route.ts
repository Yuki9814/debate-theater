import { canEncryptSecrets } from "@/lib/security/secrets";
import { getAuthenticatedUser } from "@/lib/auth/session";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
  const authenticated = await getAuthenticatedUser();
  const adminEmails = new Set(
    process.env.ADMIN_EMAILS?.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? [],
  );
  const isAdmin = authenticated ? adminEmails.has(authenticated.email.toLowerCase()) : false;

  const publicStatus = {
    ok: true,
    app: "debate-theater",
    timestamp: new Date().toISOString(),
  };

  if (!isAdmin) {
    return Response.json(publicStatus);
  }

  const authConfigured = configured(process.env.AUTH_PROVIDER) || configured(process.env.AUTH_SECRET);
  const stripeConfigured =
    configured(process.env.STRIPE_SECRET_KEY) &&
    configured(process.env.STRIPE_WEBHOOK_SECRET) &&
    configured(process.env.STRIPE_PRICE_PRO_MONTHLY) &&
    configured(process.env.STRIPE_PRICE_STUDIO_MONTHLY);
  const monitoringConfigured =
    configured(process.env.SENTRY_DSN) || configured(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const blockers = [
    !authConfigured ? "AUTH_PROVIDER/AUTH_SECRET 未配置；当前可用本地邮箱会话，但生产需接正式认证。" : null,
    !canEncryptSecrets() ? "API_KEY_ENCRYPTION_SECRET 未配置，真实 Provider Key 不能安全保存。" : null,
    !stripeConfigured ? "Stripe 价格、密钥或 webhook 未完整配置。" : null,
    !monitoringConfigured ? "生产监控未配置，缺少错误率、延迟和成本告警入口。" : null,
  ].filter(Boolean);

  return Response.json({
    ...publicStatus,
    secretEncryptionConfigured: canEncryptSecrets(),
    productionReady: blockers.length === 0,
    checks: {
      authConfigured,
      sessionAuthenticated: Boolean(authenticated),
      stripeConfigured,
      monitoringConfigured,
    },
    blockers,
  });
}
