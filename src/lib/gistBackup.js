import crypto from "node:crypto";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";

const GITHUB_GISTS_URL = "https://api.github.com/gists";
const BACKUP_FILE_NAME = "xlabrouter-backup.enc.json";
const PBKDF2_ITERATIONS = 210000;

function getEncryptionKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, "sha256");
}

function encryptPayload(payload, passphrase) {
  if (!passphrase || typeof passphrase !== "string") {
    throw new Error("Encryption passphrase is required");
  }

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey(passphrase, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    format: "xlabrouter-gist-backup",
    version: 1,
    algorithm: "aes-256-gcm",
    kdf: "pbkdf2-sha256",
    iterations: PBKDF2_ITERATIONS,
    createdAt: new Date().toISOString(),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptPayload(envelope, passphrase) {
  if (!passphrase || typeof passphrase !== "string") {
    throw new Error("Encryption passphrase is required");
  }
  if (!envelope || envelope.format !== "xlabrouter-gist-backup") {
    throw new Error("Invalid encrypted backup format");
  }

  const salt = Buffer.from(envelope.salt || "", "base64");
  const iv = Buffer.from(envelope.iv || "", "base64");
  const authTag = Buffer.from(envelope.authTag || "", "base64");
  const encrypted = Buffer.from(envelope.data || "", "base64");
  const iterations = Number(envelope.iterations || PBKDF2_ITERATIONS);
  const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function githubRequest(token, url, options = {}) {
  if (!token || typeof token !== "string") throw new Error("GitHub token is required");

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "GitHub Gist request failed");
  }
  return data;
}

export async function backupToGist({ token, gistId = "", passphrase }) {
  const backup = await createBackupBundle();
  const encrypted = encryptPayload(backup, passphrase);
  const content = JSON.stringify(encrypted, null, 2);

  const body = {
    description: "XLab Router encrypted backup",
    public: false,
    files: {
      [BACKUP_FILE_NAME]: { content },
    },
  };

  const gist = gistId
    ? await githubRequest(token, `${GITHUB_GISTS_URL}/${gistId}`, { method: "PATCH", body: JSON.stringify(body) })
    : await githubRequest(token, GITHUB_GISTS_URL, { method: "POST", body: JSON.stringify(body) });

  return {
    gistId: gist.id,
    htmlUrl: gist.html_url,
    updatedAt: gist.updated_at,
  };
}

export async function restoreFromGist({ token, gistId, passphrase }) {
  if (!gistId || typeof gistId !== "string") throw new Error("Gist ID is required");

  const gist = await githubRequest(token, `${GITHUB_GISTS_URL}/${gistId}`, { method: "GET" });
  const file = gist.files?.[BACKUP_FILE_NAME];
  if (!file?.content) throw new Error("XLab Router backup file not found in Gist");

  const envelope = JSON.parse(file.content);
  const payload = decryptPayload(envelope, passphrase);
  const result = await restoreBackupBundle(payload);

  return {
    ...result,
    gistId: gist.id,
    htmlUrl: gist.html_url,
    updatedAt: gist.updated_at,
  };
}
