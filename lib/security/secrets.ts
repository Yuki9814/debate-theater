import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const encryptedPrefix = "enc:v1";
const legacyPrefix = "local:";

function encryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret || !secret.trim() || secret.length < 32) return null;
  return createHash("sha256").update(secret).digest();
}

export function canEncryptSecrets() {
  return encryptionKey() !== null;
}

export function encryptSecret(secret: string) {
  const key = encryptionKey();
  if (!key) {
    throw new Error("API_KEY_ENCRYPTION_SECRET must be at least 32 characters before storing provider keys.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    encryptedPrefix,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(encryptedSecret?: string | null) {
  if (!encryptedSecret) return null;

  if (encryptedSecret.startsWith(legacyPrefix)) {
    const encoded = encryptedSecret.slice(legacyPrefix.length);
    if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) return null;
    return Buffer.from(encoded, "base64").toString("utf8");
  }

  if (!encryptedSecret.startsWith(`${encryptedPrefix}:`)) return null;

  const key = encryptionKey();
  if (!key) return null;

  const parts = encryptedSecret.split(":");
  if (parts.length !== 5) return null;

  const [, , ivValue, tagValue, encryptedValue] = parts;
  if (!ivValue || !tagValue || encryptedValue === undefined) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(encryptedSecret?: string | null) {
  const secret = decryptSecret(encryptedSecret);
  if (!secret) return null;
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 3)}****${secret.slice(-4)}`;
}
