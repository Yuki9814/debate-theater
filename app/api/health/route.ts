import { isAdminEmail } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { buildReadinessStatus } from "@/lib/ops/readiness";

export async function GET() {
  const authenticated = await getAuthenticatedUser();
  const isAdmin = isAdminEmail(authenticated?.email);

  const publicStatus = {
    ok: true,
    app: "debate-theater",
    timestamp: new Date().toISOString(),
  };

  if (!isAdmin) {
    return Response.json(publicStatus);
  }

  const readiness = buildReadinessStatus();

  return Response.json({
    ...publicStatus,
    productionReady: readiness.productionReady,
    checks: {
      sessionAuthenticated: Boolean(authenticated),
      appOriginConfigured: readiness.appOriginConfigured,
      authConfigured: readiness.authConfigured,
      demoModeDisabled: readiness.demoModeDisabled,
      emailConfigured: readiness.emailConfigured,
      emailProvider: readiness.emailProvider,
      secretEncryptionConfigured: readiness.secretEncryptionConfigured,
      stripeConfigured: readiness.stripeConfigured,
      searchConfigured: readiness.searchConfigured,
      rateLimitConfigured: readiness.rateLimitConfigured,
      monitoringConfigured: readiness.monitoringConfigured,
    },
    blockers: readiness.blockers,
  });
}
