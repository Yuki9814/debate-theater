import { isIP } from "node:net";
import { z } from "zod";

const defaultAllowedProviderHosts = ["api.openai.com"];

export function isHttpProviderBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function localProviderUrlsAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_PROVIDER_URLS === "true";
}

function normalizedHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function ipv4Parts(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts as [number, number, number, number];
}

function isPrivateOrSpecialIpv4(hostname: string) {
  const parts = ipv4Parts(hostname);
  if (!parts) return false;
  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateOrSpecialIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateOrSpecialIpv4(mappedIpv4[1]);
  const mappedHexIpv4 = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHexIpv4) {
    const high = Number.parseInt(mappedHexIpv4[1], 16);
    const low = Number.parseInt(mappedHexIpv4[2], 16);
    return isPrivateOrSpecialIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

export function isPrivateProviderHost(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return true;
  }

  const hostname = normalizedHostname(url);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "metadata.google.internal" ||
    hostname === "169.254.169.254"
  ) {
    return true;
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isPrivateOrSpecialIpv4(hostname);
  if (ipVersion === 6) return isPrivateOrSpecialIpv6(hostname);
  return false;
}

function configuredAllowlist() {
  const configured = process.env.PROVIDER_BASE_URL_ALLOWLIST;
  const entries = configured
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries && entries.length > 0 ? entries : defaultAllowedProviderHosts;
}

function allowlistEntryMatches(url: URL, entry: string) {
  try {
    const allowed = new URL(entry.includes("://") ? entry : `https://${entry}`);
    return url.protocol === allowed.protocol && normalizedHostname(url) === normalizedHostname(allowed);
  } catch {
    return normalizedHostname(url) === entry.toLowerCase();
  }
}

export function isAllowedProviderBaseUrl(value: string) {
  if (!isHttpProviderBaseUrl(value)) return false;
  const url = new URL(value);

  if (localProviderUrlsAllowed()) return true;
  if (url.protocol !== "https:") return false;
  if (isPrivateProviderHost(value)) return false;

  return configuredAllowlist().some((entry) => allowlistEntryMatches(url, entry));
}

export function normalizeProviderBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!isAllowedProviderBaseUrl(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}

export const providerBaseUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isAllowedProviderBaseUrl(value), {
    message: "Provider base URL 必须是允许列表内的公网 HTTPS 地址。",
  })
  .transform((value) => normalizeProviderBaseUrl(value) ?? "")
  .optional();
