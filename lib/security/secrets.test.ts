import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { canEncryptSecrets, decryptSecret, encryptSecret, maskSecret } from "./secrets.ts";

describe("secret encryption", () => {
  afterEach(() => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
  });

  it("encrypts and decrypts provider secrets without storing plaintext", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";

    const encrypted = encryptSecret("sk-test-secret-value");

    assert.equal(encrypted.includes("sk-test-secret-value"), false);
    assert.equal(decryptSecret(encrypted), "sk-test-secret-value");
    assert.equal(maskSecret(encrypted), "sk-****alue");
  });

  it("requires a production-grade encryption secret before storing keys", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "";

    assert.throws(() => encryptSecret("sk-test"), /API_KEY_ENCRYPTION_SECRET/);
  });

  it("can read legacy local development values for migration", () => {
    const legacy = `local:${Buffer.from("legacy-secret", "utf8").toString("base64")}`;

    assert.equal(decryptSecret(legacy), "legacy-secret");
  });

  it("returns null for malformed or tampered payloads", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";
    const valid = encryptSecret("test-secret");

    assert.equal(decryptSecret(valid.replace("enc:v1", "enc:v2")), null);
    assert.equal(decryptSecret("enc:v1:part1:part2"), null);
    assert.equal(decryptSecret(`${valid}:extra`), null);
    assert.equal(decryptSecret("local:!!!"), null);
    assert.equal(decryptSecret("local: "), null);

    const ciphertextTampered = valid.split(":");
    ciphertextTampered[4] = Buffer.from("tampered").toString("base64url");
    assert.equal(decryptSecret(ciphertextTampered.join(":")), null);

    const tagTampered = valid.split(":");
    tagTampered[3] = Buffer.from("wrong-tag").toString("base64url");
    assert.equal(decryptSecret(tagTampered.join(":")), null);
  });

  it("returns null when the encryption key is changed", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";
    const valid = encryptSecret("test-secret");

    process.env.API_KEY_ENCRYPTION_SECRET = "fedcba9876543210fedcba9876543210";
    assert.equal(decryptSecret(valid), null);
  });

  it("maskSecret returns null for undecryptable input", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";

    assert.equal(maskSecret("invalid-format"), null);
    assert.equal(maskSecret("enc:v1:too:short:payload"), null);
  });

  it("maskSecret handles short secrets correctly", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";
    const short = encryptSecret("12345");

    assert.equal(maskSecret(short), "****");
  });

  it("handles empty secrets", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";
    const empty = encryptSecret("");

    assert.equal(decryptSecret(empty), "");
    assert.equal(maskSecret(empty), null);
  });

  it("treats whitespace-only long encryption secrets as not configured", () => {
    for (const value of [" ".repeat(40), "\t \n ".repeat(20)]) {
      process.env.API_KEY_ENCRYPTION_SECRET = value;

      assert.equal(canEncryptSecrets(), false);
      assert.throws(() => encryptSecret("sk-test"), /API_KEY_ENCRYPTION_SECRET/);
    }
  });

  it("uses non-blank encryption secrets containing spaces verbatim", () => {
    const spaced = "0123456789abcdef0123456789abcde ";
    const trimmedEquivalent = spaced.trim();
    process.env.API_KEY_ENCRYPTION_SECRET = spaced;
    const encrypted = encryptSecret("sk-secret-value");

    process.env.API_KEY_ENCRYPTION_SECRET = trimmedEquivalent;
    assert.equal(decryptSecret(encrypted), null);

    process.env.API_KEY_ENCRYPTION_SECRET = spaced;
    assert.equal(decryptSecret(encrypted), "sk-secret-value");
  });
});
