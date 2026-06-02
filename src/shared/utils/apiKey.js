import crypto from "crypto";

const DEFAULT_API_KEY_PREFIX = "sk";
const DEFAULT_API_KEY_LENGTH = 24;
function normalizePrefix(prefix) {
  const value = String(prefix || DEFAULT_API_KEY_PREFIX).trim().toLowerCase();
  return value.replace(/[^a-z0-9]/g, "") || DEFAULT_API_KEY_PREFIX;
}

function normalizeLength(length) {
  const parsed = Number(length);
  if (!Number.isFinite(parsed)) return DEFAULT_API_KEY_LENGTH;
  return Math.min(64, Math.max(12, Math.floor(parsed)));
}

function generateKeyBody(length = DEFAULT_API_KEY_LENGTH) {
  return crypto.randomBytes(length).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(0, length);
}

export function buildApiKey({ prefix = DEFAULT_API_KEY_PREFIX, bodyLength = DEFAULT_API_KEY_LENGTH } = {}) {
  const safePrefix = normalizePrefix(prefix);
  const safeLength = normalizeLength(bodyLength);
  let body = generateKeyBody(safeLength);
  while (body.length < safeLength) body += generateKeyBody(safeLength - body.length);
  return `${safePrefix}-${body.slice(0, safeLength)}`;
}

export function isApiKeyFormat(value) {
  if (typeof value !== "string") return false;
  return /^[a-z0-9][a-z0-9-]*-[A-Za-z0-9]{12,64}$/.test(value.trim());
}

export function normalizeApiKey(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

