import { canEncryptSecrets } from "@/lib/security/secrets";

export async function GET() {
  return Response.json({
    ok: true,
    app: "debate-theater",
    mockMode: true,
    secretEncryptionConfigured: canEncryptSecrets(),
    timestamp: new Date().toISOString(),
  });
}
