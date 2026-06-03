import { randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../errors.ts";
import { csrfCookieName } from "../auth/constants.ts";
import { csrfHeaderName } from "./csrf-constants.ts";

export function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function canonicalOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function serializeCsrfCookie(token: string) {
  const parts = [
    `${csrfCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=3600",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("缺少请求来源，请刷新页面后重试。", 403, "ORIGIN_REQUIRED");
    }
    return;
  }

  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    throw new AppError("请求来源无效。", 403, "ORIGIN_INVALID");
  }

  if (normalized !== canonicalOrigin(request)) {
    throw new AppError("跨站请求已被拦截。", 403, "ORIGIN_MISMATCH");
  }
}

export function requireMutationSecurity(request: Request, options: { csrf?: boolean } = {}) {
  requireSameOrigin(request);
  if (options.csrf === false) return;

  const headerToken = request.headers.get(csrfHeaderName);
  const cookieToken = cookieValue(request, csrfCookieName);
  if (!headerToken || !cookieToken || !safeEqual(headerToken, cookieToken)) {
    throw new AppError("页面安全令牌已失效，请刷新后重试。", 403, "CSRF_INVALID");
  }
}
