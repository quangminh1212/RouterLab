import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSettings, updateSettings } from "@/lib/localDb";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ISSUER = "RouterLab";
const TOTP_ACCOUNT = "Dashboard";

function base32Encode(buffer) {
  let bits = "";
  let output = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value) {
  const clean = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

function createBackupCode() {
  return randomBytes(5).toString("hex").toUpperCase().replace(/^(.{5})(.{5})$/, "$1-$2");
}

function normalizeBackupCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashBackupCode(code) {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

function safeEqualToken(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function getOrCreateTotpSecret({ rotate = false } = {}) {
  const settings = await getSettings();
  const existing = typeof settings.totpSecret === "string" ? settings.totpSecret.trim() : "";
  const secret = rotate || !existing ? createTotpSecret() : existing;
  if (secret !== existing) {
    await updateSettings({ totpSecret: secret, totpRotatedAt: new Date().toISOString() });
  }
  return secret;
}

export async function generateBackupCodes(count = 10) {
  const codes = Array.from({ length: count }, () => createBackupCode());
  await updateSettings({
    totpBackupCodeHashes: codes.map(hashBackupCode),
    totpBackupCodesGeneratedAt: new Date().toISOString(),
  });
  return codes;
}

export async function getBackupCodeCount() {
  const settings = await getSettings();
  return Array.isArray(settings.totpBackupCodeHashes) ? settings.totpBackupCodeHashes.length : 0;
}

export async function verifyAndConsumeBackupCode(code) {
  const normalized = normalizeBackupCode(code);
  if (!normalized) return false;
  const settings = await getSettings();
  const hashes = Array.isArray(settings.totpBackupCodeHashes) ? settings.totpBackupCodeHashes : [];
  const targetHash = hashBackupCode(normalized);
  const matchedIndex = hashes.findIndex((hash) => safeEqualToken(hash, targetHash));
  if (matchedIndex < 0) return false;
  const nextHashes = hashes.filter((_, index) => index !== matchedIndex);
  await updateSettings({
    totpBackupCodeHashes: nextHashes,
    totpBackupCodeLastUsedAt: new Date().toISOString(),
  });
  return true;
}

export function buildTotpUri(secret) {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${TOTP_ACCOUNT}`);
  const issuer = encodeURIComponent(TOTP_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function verifyTotpCode(secret, code, { window = 1 } = {}) {
  const normalized = String(code || "").replace(/\D/g, "").slice(0, TOTP_DIGITS);
  if (normalized.length !== TOTP_DIGITS || !secret) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqualToken(hotp(secret, currentCounter + offset), normalized)) return true;
  }
  return false;
}
