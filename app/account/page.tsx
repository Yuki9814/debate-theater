import { AccountPanel } from "@/components/account/account-panel";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUser, getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const authenticated = await getAuthenticatedUser();
  const user = authenticated ?? (await getCurrentUser());
  if (!user) redirect("/login");
  return (
    <AppShell>
      <AccountPanel
        authenticated={Boolean(authenticated)}
        user={{
          email: user.email,
          name: user.name,
        }}
      />
    </AppShell>
  );
}
