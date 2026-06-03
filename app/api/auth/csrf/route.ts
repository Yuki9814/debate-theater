import { createCsrfToken, serializeCsrfCookie } from "@/lib/security/mutation";

export async function GET() {
  const csrfToken = createCsrfToken();
  return Response.json(
    { csrfToken },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": serializeCsrfCookie(csrfToken),
      },
    },
  );
}
