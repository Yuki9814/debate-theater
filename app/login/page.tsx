import { AppShell } from "@/components/layout/app-shell";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <AppShell>
      <LoginForm />
    </AppShell>
  );
}
