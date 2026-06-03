import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { prisma } from "../db/prisma.ts";
import { authCookieName, csrfCookieName } from "./constants.ts";

export { authCookieName, csrfCookieName };

const demoUser = {
  email: "demo@debate-theater.local",
  name: "论衡剧场本地用户",
};

const loginTokenTtlMinutes = 15;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isDemoModeAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
}

function sessionExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}

function loginTokenExpiresAt() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + loginTokenTtlMinutes);
  return date;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };
}

export async function ensureDemoUser() {
  await prisma.authSession.deleteExpired({ now: new Date() });
  return prisma.user.upsert({
    where: { email: demoUser.email },
    update: {},
    create: demoUser,
  });
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.authSession.delete({ where: { tokenHash: session.tokenHash } });
    }
    return null;
  }

  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function getCurrentUser() {
  const authenticated = await getAuthenticatedUser();
  if (authenticated) return authenticated;
  if (isDemoModeAllowed()) return ensureDemoUser();
  return null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("请先登录后再继续。", 401, "AUTH_REQUIRED");
  }
  return user;
}

export async function createLoginLink(input: { email: string; name?: string | null; origin: string }) {
  const email = input.email.trim().toLowerCase();
  await prisma.authLoginToken.deleteExpired({ now: new Date() });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = loginTokenExpiresAt();
  await prisma.authLoginToken.create({
    data: {
      email,
      name: input.name?.trim() || null,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  const verificationUrl = new URL("/login", input.origin);
  verificationUrl.searchParams.set("token", token);
  return {
    expiresAt,
    verificationUrl: verificationUrl.toString(),
  };
}

export async function verifyLoginToken(token: string) {
  await prisma.authLoginToken.deleteExpired({ now: new Date() });
  const tokenHash = hashSessionToken(token);
  const loginToken = await prisma.authLoginToken.findUnique({ where: { tokenHash } });
  if (!loginToken || loginToken.usedAt || loginToken.expiresAt <= new Date()) {
    throw new AppError("登录链接已失效，请重新申请。", 401, "LOGIN_TOKEN_EXPIRED");
  }

  const user = await prisma.user.upsert({
    where: { email: loginToken.email },
    update: {},
    create: {
      email: loginToken.email,
      name: loginToken.name?.trim() || loginToken.email.split("@")[0] || "论衡用户",
    },
  });

  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiresAt();
  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(authCookieName, sessionToken, cookieOptions(expiresAt));
  await prisma.authLoginToken.markUsed({ where: { tokenHash }, usedAt: new Date() });
  return user;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (token) {
    await prisma.authSession.delete({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookieStore.set(authCookieName, "", clearCookieOptions());
}

export async function deleteCurrentAccount() {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  await prisma.user.deleteCascade({ where: { id: user.id } });
  const cookieStore = await cookies();
  cookieStore.set(authCookieName, "", clearCookieOptions());
  return true;
}
