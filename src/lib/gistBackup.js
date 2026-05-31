import crypto from "node:crypto";
import {
  createBackupBundle,
  restoreBackupBundle,
  isBackupBundle,
  isUsageBackupPayload,
} from "@/lib/backupBundle";

const GITHUB_GISTS_URL = "https://api.github.com/gists";
const BACKUP_FILE_NAME = "xlabrouter.backup.json";
const LEGACY_PLAIN_FILE_NAME = "xlabrouter.enc.json";
const LEGACY_ENCRYPTED_FILE_NAME = "xlabrouter-backup.enc.json";
const BACKUP_GIST_DESCRIPTION = "xlabrouter";
const LEGACY_BACKUP_GIST_DESCRIPTION = "XLab Router encrypted backup";
const LEGACY_ENVELOPE_FORMAT = "xlabrouter-gist-backup";
const PBKDF2_ITERATIONS = 210000;
const GITHUB_API_TIMEOUT_MS = Number(process.env.XLAB_GIST_API_TIMEOUT_MS || 15000);
const GITHUB_RAW_TIMEOUT_MS = Number(process.env.XLAB_GIST_RAW_TIMEOUT_MS || 20000);

function createTimeoutError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GITHUB_API_TIMEOUT_MS, timeoutMessage = "GitHub request timed out") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(createTimeoutError(timeoutMessage)), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createTimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getEncryptionKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  return crypto.pbkdf2Sync(passphrase, salt, iterations, 32, "sha256");
}

function decryptLegacyPayload(envelope, passphrase) {
  if (!passphrase || typeof passphrase !== "string") {
    throw new Error("Encryption passphrase is required");
  }
  if (!envelope || envelope.format !== LEGACY_ENVELOPE_FORMAT) {
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
  const key = getEncryptionKey(passphrase, salt, iterations);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return safeJsonParse(decrypted.toString("utf8"));
}

function decryptLegacyPayloadWithFallback(envelope, passphrases) {
  const candidates = Array.from(new Set((Array.isArray(passphrases) ? passphrases : [passphrases]).filter(Boolean)));
  let lastError = null;

  for (const passphrase of candidates) {
    try {
      return decryptLegacyPayload(envelope, passphrase);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Cannot decrypt legacy Gist backup");
}

function normalizeGitHubGistErrorMessage({ status, message, details }) {
  const rawMessage = String(message || "").trim();
  const normalized = rawMessage.toLowerCase();

  if (status === 401 || normalized.includes("bad credentials") || normalized.includes("requires authentication")) {
    return "GitHub access token is invalid, expired, or missing gist scope. Enter a valid token with gist scope and try again.";
  }

  if (status === 403) {
    if (normalized.includes("rate limit")) {
      return "GitHub API rate limit reached. Wait a few minutes and try again.";
    }
    return "GitHub rejected this request (403). Verify token permissions and account access, then try again.";
  }

  if (status === 404) {
    return "GitHub Gist not found or inaccessible. Check gist ID and token permissions.";
  }

  if (status === 422) {
    return "GitHub rejected the Gist payload (422). Verify gist ID and backup data format, then try again.";
  }

  const base = rawMessage || "GitHub Gist request failed";
  return details ? `${base}: ${details}` : base;
}


async function githubRequest(token, url, options = {}) {
  if (!token || typeof token !== "string") throw new Error("GitHub token is required");

  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
    cache: "no-store",
  }, GITHUB_API_TIMEOUT_MS, "GitHub Gist request timed out");

  const rawText = await response.text().catch(() => "");
  let data = {};
  if (rawText) {
    try {
      data = safeJsonParse(rawText);
    } catch {
      data = { message: rawText.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const details = Array.isArray(data?.errors)
      ? data.errors.map((item) => [item.resource, item.field, item.code].filter(Boolean).join(".")).filter(Boolean).join(", ")
      : "";
    const message = normalizeGitHubGistErrorMessage({
      status: response.status,
      message: data?.message || "GitHub Gist request failed",
      details,
    });
    const error = new Error(message);
    error.status = response.status;
    error.response = data;
    error.details = details;
    throw error;
  }

  return data;
}

async function findExistingBackupGist(token) {
  const gists = await githubRequest(token, `${GITHUB_GISTS_URL}?per_page=100`, { method: "GET" });
  if (!Array.isArray(gists)) return null;

  const candidates = gists.filter((gist) => {
    const hasBackupFile = Boolean(
      gist?.files?.[BACKUP_FILE_NAME]
      || gist?.files?.[LEGACY_PLAIN_FILE_NAME]
      || gist?.files?.[LEGACY_ENCRYPTED_FILE_NAME]
    );
    const hasBackupDescription = gist?.description === BACKUP_GIST_DESCRIPTION || gist?.description === LEGACY_BACKUP_GIST_DESCRIPTION;
    return hasBackupFile || hasBackupDescription;
  });

  if (candidates.length === 0) return null;

  const score = (gist) => {
    const hasExactFile = Boolean(gist?.files?.[BACKUP_FILE_NAME]);
    const hasExactDesc = gist?.description === BACKUP_GIST_DESCRIPTION;
    const hasLegacyFile = Boolean(gist?.files?.[LEGACY_PLAIN_FILE_NAME] || gist?.files?.[LEGACY_ENCRYPTED_FILE_NAME]);
    const updatedAt = Number(new Date(gist?.updated_at || 0).getTime()) || 0;
    return [hasExactFile ? 4 : 0, hasExactDesc ? 2 : 0, hasLegacyFile ? 1 : 0, updatedAt];
  };

  candidates.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let index = 0; index < sa.length; index += 1) {
      if (sa[index] !== sb[index]) return sb[index] - sa[index];
    }
    return 0;
  });

  return candidates[0] || null;
}

async function readFullGistFileContent(token, file) {
  let content = typeof file?.content === "string" ? file.content : "";
  if ((!content || file?.truncated === true) && typeof file?.raw_url === "string" && file.raw_url) {
    const rawRes = await fetchWithTimeout(file.raw_url, {
      headers: {
        Accept: "application/vnd.github.raw",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    }, GITHUB_RAW_TIMEOUT_MS, "Downloading full Gist backup timed out");

    if (!rawRes.ok) {
      throw new Error("Failed to download full Gist backup content");
    }
    content = await rawRes.text();
  }
  return content;
}

function isValidBackupPayload(payload) {
  return isBackupBundle(payload) || isUsageBackupPayload(payload);
}

function stripBomAndWhitespace(text) {
  if (typeof text !== "string") return text;
  let s = text;
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s.trimStart();
}

function safeJsonParse(text) {
  return JSON.parse(stripBomAndWhitespace(text || ""));
}

function parseGistBackupPayload(content, passphrases) {
  let parsed;
  try {
    parsed = safeJsonParse(content);
  } catch {
    throw new Error("Gist backup content is corrupted or incomplete");
  }

  if (parsed?.format === LEGACY_ENVELOPE_FORMAT) {
    const legacyPayload = decryptLegacyPayloadWithFallback(parsed, passphrases);
    if (!isValidBackupPayload(legacyPayload)) {
      throw new Error("Legacy Gist backup payload is invalid");
    }
    return legacyPayload;
  }

  if (!isValidBackupPayload(parsed)) {
    throw new Error("Gist backup JSON format is invalid");
  }

  return parsed;
}

async function verifyBackupGist(token, gist) {
  const file = gist?.files?.[BACKUP_FILE_NAME] || gist?.files?.[LEGACY_PLAIN_FILE_NAME] || gist?.files?.[LEGACY_ENCRYPTED_FILE_NAME];
  if (!file) throw new Error("Backup file missing after Gist write");
  const content = await readFullGistFileContent(token, file);
  if (!content) throw new Error("Backup file content is empty after Gist write");

  let parsed;
  try {
    parsed = safeJsonParse(content);
  } catch {
    throw new Error("Backup file content is not valid JSON after Gist write");
  }

  if (!isValidBackupPayload(parsed)) {
    throw new Error("Backup file format is invalid after Gist write");
  }
}

export async function backupToGist({ token, gistId = "", payload = null }) {
  const backup = payload || await createBackupBundle({ includeUsage: true, includeRequestDetails: false });
  const content = JSON.stringify(backup, null, 2);

  const createBody = {
    description: BACKUP_GIST_DESCRIPTION,
    public: false,
    files: {
      [BACKUP_FILE_NAME]: { content },
    },
  };

  const updateBody = createBody;

  const existingGist = gistId ? null : await findExistingBackupGist(token);
  const resolvedGistId = gistId || existingGist?.id || "";

  let gist;
  if (resolvedGistId) {
    try {
      gist = await githubRequest(token, `${GITHUB_GISTS_URL}/${resolvedGistId}`, {
        method: "PATCH",
        body: JSON.stringify(updateBody),
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
          body: JSON.stringify(updateBody),
        });
      } else {
        gist = await githubRequest(token, GITHUB_GISTS_URL, {
          method: "POST",
          body: JSON.stringify(createBody),
        });
      }
    }
  } else {
    gist = await githubRequest(token, GITHUB_GISTS_URL, {
      method: "POST",
      body: JSON.stringify(createBody),
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
  const candidates = [];
  if (gistId) {
    candidates.push({ id: gistId });
  } else {
    const preferred = await findExistingBackupGist(token);
    if (preferred?.id) {
      candidates.push(preferred);
    }

    const gists = await githubRequest(token, `${GITHUB_GISTS_URL}?per_page=100`, { method: "GET" });
    if (Array.isArray(gists)) {
      for (const gist of gists) {
        if (!gist?.id || candidates.some((item) => item?.id === gist.id)) continue;
        const hasCandidateFile = Boolean(
          gist?.files?.[BACKUP_FILE_NAME]
          || gist?.files?.[LEGACY_PLAIN_FILE_NAME]
          || gist?.files?.[LEGACY_ENCRYPTED_FILE_NAME]
        );
        const hasCandidateDescription = gist?.description === BACKUP_GIST_DESCRIPTION || gist?.description === LEGACY_BACKUP_GIST_DESCRIPTION;
        if (hasCandidateFile || hasCandidateDescription) {
          candidates.push(gist);
        }
      }
    }
  }

  if (candidates.length === 0) throw new Error("No XLab Router backup Gist found yet");

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const gist = await githubRequest(token, `${GITHUB_GISTS_URL}/${candidate.id}`, { method: "GET" });
      const file = gist.files?.[BACKUP_FILE_NAME] || gist.files?.[LEGACY_PLAIN_FILE_NAME] || gist.files?.[LEGACY_ENCRYPTED_FILE_NAME];
      if (!file) {
        throw new Error("XLab Router backup file not found in Gist");
      }

      const content = await readFullGistFileContent(token, file);
      if (!content) {
        throw new Error("XLab Router backup file content is empty");
      }

      const payload = parseGistBackupPayload(content, passphrases || passphrase);
      const result = await restoreBackupBundle(payload);
      return {
        ...result,
        gistId: gist.id,
        htmlUrl: gist.html_url,
        updatedAt: gist.updated_at,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No restorable XLab Router backup Gist found");
}
