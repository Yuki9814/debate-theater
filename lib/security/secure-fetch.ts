"use client";

import { csrfHeaderName } from "./csrf-constants";

let cachedToken: string | null = null;

async function csrfToken() {
  if (cachedToken) return cachedToken;
  const response = await fetch("/api/auth/csrf", { method: "GET" });
  const payload = (await response.json()) as { csrfToken?: string };
  if (!response.ok || !payload.csrfToken) {
    throw new Error("无法获取页面安全令牌。");
  }
  cachedToken = payload.csrfToken;
  return cachedToken;
}

export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return fetch(input, init);
  }

  const headers = new Headers(init.headers);
  headers.set(csrfHeaderName, await csrfToken());
  return fetch(input, {
    ...init,
    method,
    headers,
  });
}
