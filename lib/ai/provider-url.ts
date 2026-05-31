import { z } from "zod";

export function isHttpProviderBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeProviderBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!isHttpProviderBaseUrl(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}

export const providerBaseUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isHttpProviderBaseUrl(value), {
    message: "Provider base URL must use http or https.",
  })
  .transform((value) => normalizeProviderBaseUrl(value) ?? "")
  .optional();
