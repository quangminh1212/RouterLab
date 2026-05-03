import crypto from "node:crypto";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";

const GITHUB_GISTS_URL = "https://api.github.com/gists";
const BACKUP_FILE_NAME = "xlabrouter.enc.json";
const LEGACY_BACKUP_FILE_NAME = "xlabrouter-backup.enc.json";
const BACKUP_GIST_DESCRIPTION = "xlabrouter";
const LEGACY_BACKUP_GIST_DESCRIPTION = "XLab Router encrypted backup";
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
  if (!envelope.data) {
    throw new Error("This Gist backup does not contain a restorable data payload");
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

function decryptPayloadWithFallback(envelope, passphrases) {
  const candidates = Array.from(new Set((Array.isArray(passphrases) ? passphrases : [passphrases]).filter(Boolean)));
  let lastError = null;

  for (const passphrase of candidates) {
    try {
      return decryptPayload(envelope, passphrase);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Cannot decrypt Gist backup");
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
    cache: "no-store",
  });

  const rawText = await response.text().catch(() => "");
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText.slice(0, 500) };
    }
  }
  if (!response.ok) {
    const details = Array.isArray(data?.errors)
      ? data.errors.map((item) => [item.resource, item.field, item.code].filter(Boolean).join(".")).filter(Boolean).join(", ")
      : "";
    const message = [data?.message || "GitHub Gist request failed", details].filter(Boolean).join(": ");
    throw new Error(message);
  }
  return data;
}

async function findExistingBackupGist(token) {
  const gists = await githubRequest(token, `${GITHUB_GISTS_URL}?per_page=100`, { method: "GET" });
  if (!Array.isArray(gists)) return null;

  return gists.find((gist) => {
    const hasBackupFile = Boolean(gist?.files?.[BACKUP_FILE_NAME] || gist?.files?.[LEGACY_BACKUP_FILE_NAME]);
    const hasBackupDescription = gist?.description === BACKUP_GIST_DESCRIPTION || gist?.description === LEGACY_BACKUP_GIST_DESCRIPTION;
    return hasBackupFile || hasBackupDescription;
  }) || null;
}

async function readFullGistFileContent(token, file) {
  let content = typeof file?.content === "string" ? file.content : "";
  if ((!content || file?.truncated === true) && typeof file?.raw_url === "string" && file.raw_url) {
    const rawRes = await fetch(file.raw_url, {
      headers: {
        Accept: "application/vnd.github.raw",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (!rawRes.ok) {
      throw new Error("Failed to download full Gist backup content");
    }
    content = await rawRes.text();
  }
  return content;
}

async function verifyBackupGist(token, gist) {
  const file = gist?.files?.[BACKUP_FILE_NAME] || gist?.files?.[LEGACY_BACKUP_FILE_NAME];
  if (!file) throw new Error("Backup file missing after Gist write");
  const content = await readFullGistFileContent(token, file);
  if (!content) throw new Error("Backup file content is empty after Gist write");

  let envelope;
  try {
    envelope = JSON.parse(content);
  } catch {
    throw new Error("Backup file content is not valid JSON after Gist write");
  }

  if (envelope?.format !== "xlabrouter-gist-backup") {
    throw new Error("Backup file format is invalid after Gist write");
  }
}

export async function backupToGist({ token, gistId = "", passphrase, payload = null }) {
  const backup = payload || await createBackupBundle({ includeUsage: true, includeRequestDetails: false });
  const encrypted = encryptPayload(backup, passphrase);
  const content = JSON.stringify(encrypted, null, 2);

  const body = {
    description: BACKUP_GIST_DESCRIPTION,
    public: false,
    files: {
      [BACKUP_FILE_NAME]: { content },
    },
  };

  const existingGist = gistId ? null : await findExistingBackupGist(token);
  const resolvedGistId = gistId || existingGist?.id || "";

  let gist;
  if (resolvedGistId) {
    try {
      gist = await githubRequest(token, `${GITHUB_GISTS_URL}/${resolvedGistId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch (error) {
      const message = String(error?.message || "");
      if (!/not found|validation failed/i.test(message)) {
        throw error;
      }

      const fallbackExisting = await findExistingBackupGist(token);
      const fallbackGistId = String(fallbackExisting?.id || "");

      if (fallbackGistId && fallbackGistId !== resolvedGistId) {
        gist = await githubRequest(token, `${GITHUB_GISTS_URL}/${fallbackGistId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        gist = await githubRequest(token, GITHUB_GISTS_URL, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
    }
  } else {
    gist = await githubRequest(token, GITHUB_GISTS_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  await verifyBackupGist(token, gist);

  return {
    gistId: gist.id,
    htmlUrl: gist.html_url,
    updatedAt: gist.updated_at,
  };
}

export async function restoreFromGist({ token, gistId, passphrase, passphrases }) {
  const existingGist = gistId ? null : await findExistingBackupGist(token);
  const resolvedGistId = gistId || existingGist?.id || "";
  if (!resolvedGistId) throw new Error("No XLab Router backup Gist found yet");

  const gist = await githubRequest(token, `${GITHUB_GISTS_URL}/${resolvedGistId}`, { method: "GET" });
  const file = gist.files?.[BACKUP_FILE_NAME] || gist.files?.[LEGACY_BACKUP_FILE_NAME];
  if (!file) throw new Error("XLab Router backup file not found in Gist");

  const content = await readFullGistFileContent(token, file);

  if (!content) {
    throw new Error("XLab Router backup file content is empty");
  }

  let envelope;
  try {
    envelope = JSON.parse(content);
  } catch {
    throw new Error("Gist backup content is corrupted or incomplete");
  }
  const payload = decryptPayloadWithFallback(envelope, passphrases || passphrase);
  const result = await restoreBackupBundle(payload);

  return {
    ...result,
    gistId: gist.id,
    htmlUrl: gist.html_url,
    updatedAt: gist.updated_at,
  };
}

