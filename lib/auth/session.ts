import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "../db/prisma.ts";

export const authCookieName = "lunheng_session";

const demoUser = {
  email: "demo@debate-theater.local",
  name: "论衡剧场本地用户",
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
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
  return (await getAuthenticatedUser()) ?? ensureDemoUser();
}

export async function signInWithEmail(input: { email: string; name?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: input.name?.trim() || email.split("@")[0] || "论衡用户",
    },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiresAt();
  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(authCookieName, token, cookieOptions(expiresAt));
  return user;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (token) {
    await prisma.authSession.delete({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookieStore.delete(authCookieName);
}

export async function deleteCurrentAccount() {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  await prisma.user.deleteCascade({ where: { id: user.id } });
  const cookieStore = await cookies();
  cookieStore.delete(authCookieName);
  return true;
}
