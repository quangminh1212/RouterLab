import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

const SECRET_FILE = path.join(DATA_DIR, ".session-secret");

function loadOrCreateSecret() {
  if (process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim()) {
    return String(process.env.JWT_SECRET).trim();
  }

  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (existing) return existing;
    }
  } catch {
    // fall through to generate
  }

  const generated = crypto.randomBytes(48).toString("base64url");
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, generated, { encoding: "utf8", mode: 0o600 });
  } catch {
    // Best effort: if write fails, still use generated secret for current process.
  }
  return generated;
}

export function getAuthSecret() {
  return new TextEncoder().encode(loadOrCreateSecret());
}
