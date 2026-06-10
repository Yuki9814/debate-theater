import { canEncryptSecrets } from "../security/secrets.ts";
import { getEmailReadiness } from "../auth/email.ts";
import { researchCredentialEnvName } from "../research/source-cards.ts";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

export function buildReadinessStatus() {
  const email = getEmailReadiness();
  const authConfigured =
    email.deliveryEnabled ||
    (configured(process.env.AUTH_PROVIDER) && configured(process.env.AUTH_SECRET));
  const appOriginConfigured = configured(process.env.APP_ORIGIN);
  const secretEncryptionConfigured = canEncryptSecrets();
  const stripeConfigured =
    configured(process.env.STRIPE_SECRET_KEY) &&
    configured(process.env.STRIPE_WEBHOOK_SECRET) &&
    configured(process.env.STRIPE_PRICE_PRO_MONTHLY) &&
    configured(process.env.STRIPE_PRICE_STUDIO_MONTHLY);
  const searchConfigured = configured(process.env[researchCredentialEnvName()]);
  const rateLimitConfigured =
    process.env.RATE_LIMIT_BACKEND === "upstash" &&
    configured(process.env.UPSTASH_REDIS_REST_URL) &&
    configured(process.env.UPSTASH_REDIS_REST_TOKEN);
  const monitoringConfigured =
    configured(process.env.SENTRY_DSN) || configured(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const demoModeDisabled = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE !== "true";

  const blockers = [
    !appOriginConfigured ? "APP_ORIGIN 未配置，生产回调来源不固定。" : null,
    !authConfigured ? "认证邮件或正式认证服务未配置。" : null,
    !demoModeDisabled ? "生产环境不得启用 DEMO_MODE。" : null,
    !secretEncryptionConfigured ? "API_KEY_ENCRYPTION_SECRET 未配置，真实 Provider Key 不能安全保存。" : null,
    !stripeConfigured ? "Stripe 价格、密钥或 webhook 未完整配置。" : null,
    !searchConfigured ? "Tavily 搜索凭据未配置，热点资料会降级为占位入口。" : null,
    !rateLimitConfigured ? "Upstash 限流未配置，生产多实例无法共享限流桶。" : null,
    !monitoringConfigured ? "生产监控未配置，缺少错误率、延迟和成本告警入口。" : null,
  ].filter(Boolean) as string[];

  return {
    appOriginConfigured,
    authConfigured,
    demoModeDisabled,
    emailConfigured: email.deliveryEnabled,
    emailProvider: email.provider,
    secretEncryptionConfigured,
    stripeConfigured,
    searchConfigured,
    rateLimitConfigured,
    monitoringConfigured,
    productionReady: blockers.length === 0,
    blockers,
  };
}
