import { AppError } from "../errors.ts";

function normalizedEmails(value: string | null | undefined) {
  return new Set(
    value
      ?.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? [],
  );
}

export function isAdminEmail(email: string | null | undefined, configuredEmails = process.env.ADMIN_EMAILS) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return normalizedEmails(configuredEmails).has(normalized);
}

export function requireAdminEmail(email: string | null | undefined, configuredEmails = process.env.ADMIN_EMAILS) {
  if (!email) {
    throw new AppError("请先登录后再继续。", 401, "AUTH_REQUIRED");
  }
  if (!isAdminEmail(email, configuredEmails)) {
    throw new AppError("需要管理员权限。", 403, "ADMIN_REQUIRED");
  }
}
