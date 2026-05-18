import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { backupToGist, restoreFromGist } from "@/lib/gistBackup";

const execFileAsync = promisify(execFile);
const GITHUB_USER_CHECK_TIMEOUT_MS = Number(process.env.XLAB_GIST_AUTH_TIMEOUT_MS || 12000);

function createTimeoutError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GITHUB_USER_CHECK_TIMEOUT_MS, timeoutMessage = "GitHub request timed out") {
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

function toPublicConfig(settings) {
  const gistBackup = settings?.gistBackup || {};
  return {
    enabled: gistBackup.enabled === true,
    hasToken: !!gistBackup.token,
    gistId: gistBackup.gistId || "",
    htmlUrl: gistBackup.htmlUrl || "",
    updatedAt: gistBackup.updatedAt || "",
    fileName: gistBackup.fileName || "xlabrouter.backup.json",
    tokenSource: gistBackup.tokenSource || "",
    githubLogin: gistBackup.githubLogin || "",
  };
}

async function validateGitHubToken(token) {
  const res = await fetchWithTimeout("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "XLab-Router",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  }, GITHUB_USER_CHECK_TIMEOUT_MS, "GitHub auth check timed out");

  if (!res.ok) {
    const err = new Error("GitHub token is invalid or missing required access");
    err.status = res.status;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  return {
    login: typeof data?.login === "string" ? data.login : "",
  };
}

async function getGitHubCliToken() {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"], {
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 16 * 1024,
    });
    const token = String(stdout || "").trim();
    if (!token) {
      throw new Error("GitHub CLI did not return a token");
    }
    return token;
  } catch (error) {
    const message = error?.code === "ENOENT"
      ? "GitHub CLI is not installed. Install gh and run gh auth login first."
      : "Cannot read GitHub CLI token. Run gh auth login first, then try again.";
    throw new Error(message);
  }
}

async function refreshGitHubCliAuth() {
  await execFileAsync("gh", ["auth", "refresh", "--hostname", "github.com", "--scopes", "gist,repo,read:org"], {
    timeout: 30000,
    windowsHide: true,
    maxBuffer: 32 * 1024,
  });
}

async function getGitHubCliLoginViaApi() {
  const { stdout } = await execFileAsync("gh", ["api", "user", "--jq", ".login"], {
    timeout: 10000,
    windowsHide: true,
    maxBuffer: 16 * 1024,
  });
  return String(stdout || "").trim();
}

async function getGitHubCliStatus() {
  const { stdout } = await execFileAsync("gh", ["auth", "status", "--hostname", "github.com", "--json", "hosts"], {
    timeout: 10000,
    windowsHide: true,
    maxBuffer: 64 * 1024,
  });
  const parsed = JSON.parse(String(stdout || "{}").replace(/^\uFEFF/, "").trimStart() || "{}");
  const entry = parsed?.hosts?.["github.com"]?.find?.((item) => item?.active) || parsed?.hosts?.["github.com"]?.[0] || null;
  return {
    login: typeof entry?.login === "string" ? entry.login.trim() : "",
    active: entry?.active === true,
    state: typeof entry?.state === "string" ? entry.state : "",
    error: typeof entry?.error === "string" ? entry.error : "",
    tokenSource: typeof entry?.tokenSource === "string" ? entry.tokenSource : "",
  };
}

async function resolveGitHubCliIdentity(token, fallbackLogin = "") {
  try {
    const user = await validateGitHubToken(token);
    return {
      token,
      githubLogin: user.login || fallbackLogin || "",
    };
  } catch (error) {
    if (!isGitHubAuthError(error)) {
      throw error;
    }
  }

  try {
    const login = await getGitHubCliLoginViaApi();
    if (login) {
      return {
        token,
        githubLogin: login || fallbackLogin || "",
      };
    }
  } catch {}

  try {
    const status = await getGitHubCliStatus();
    if (status.active && status.login && !status.error) {
      return {
        token,
        githubLogin: status.login || fallbackLogin || "",
      };
    }
  } catch {}

  const err = new Error("GitHub CLI token is invalid or GitHub CLI session cannot access user identity.");
  err.status = 401;
  throw err;
}

async function getValidatedGitHubCliAuth(fallbackLogin = "") {
  let token = await getGitHubCliToken();
  try {
    return await resolveGitHubCliIdentity(token, fallbackLogin);
  } catch (error) {
    if (isGitHubAuthError(error)) {
      try {
        await refreshGitHubCliAuth();
        token = await getGitHubCliToken();
        return await resolveGitHubCliIdentity(token, fallbackLogin);
      } catch (refreshError) {
        const err = new Error("GitHub CLI token is invalid and automatic refresh failed. Run gh auth login first.");
        err.cause = refreshError;
        throw err;
      }
    }
    throw error;
  }
}

function isGitHubAuthError(error) {
  const status = Number(error?.status || 0);
  if (status === 401 || status === 403) return true;

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("bad credentials")
    || message.includes("requires authentication")
    || message.includes("invalid or missing")
    || message.includes("forbidden")
    || message.includes("insufficient")
  );
}

async function resolveGitHubLogin(token, fallback = "") {
  try {
    const user = await validateGitHubToken(token);
    return user.login || fallback || "";
  } catch {
    return fallback || "";
  }
}

async function ensureCliAuth(current) {
  const storedToken = String(current?.token || "").trim();
  const storedLogin = String(current?.githubLogin || "").trim();
  const tokenSource = String(current?.tokenSource || "").trim().toLowerCase();

  // V?i gh-cli: lu?n ?u ti?n l?y token m?i nh?t t? GitHub CLI
  // ?? CLI t? refresh access token b?ng refresh token n?i b?.
  const preferGhCli = tokenSource === "gh-cli" || !storedToken;
  if (preferGhCli) {
    try {
      return await getValidatedGitHubCliAuth(storedLogin);
    } catch (error) {
      if (!storedToken) throw error;
    }
  }

  // Fallback token ?? l?u (v? d? PAT) khi gh CLI kh?ng s?n s?ng.
  if (storedToken) {
    try {
      const user = await validateGitHubToken(storedToken);
      return {
        token: storedToken,
        githubLogin: user.login || storedLogin,
      };
    } catch (error) {
      if (!isGitHubAuthError(error)) {
        return {
          token: storedToken,
          githubLogin: storedLogin,
        };
      }
    }
  }

  // Cu?i c?ng th? l?i gh CLI l?n n?a tr??c khi b?o l?i login.
  return await getValidatedGitHubCliAuth(storedLogin);
}

async function launchGitHubCliRefreshWindow() {
  try {
    await execFileAsync("powershell.exe", [
      "-Command",
      "Start-Process -FilePath powershell.exe -ArgumentList '-NoExit','-Command','gh auth refresh --hostname github.com --scopes gist,repo,read:org'",
    ], {
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 16 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

function buildStableGistPassphrase({ token, githubLogin }) {
  const login = String(githubLogin || "").trim().toLowerCase();
  if (!login) return token;
  return `xlabrouter-gist-sync:${login}`;
}

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(toPublicConfig(settings));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load Gist backup settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action || "";
    const settings = await getSettings();
    const current = settings?.gistBackup || {};

    if (action === "use-gh-cli") {
      try {
        const auth = await getValidatedGitHubCliAuth(current.githubLogin || "");
        const nextConfig = {
          ...current,
          enabled: true,
          token: auth.token,
          tokenSource: "gh-cli",
          githubLogin: auth.githubLogin,
          fileName: current.fileName || "xlabrouter.backup.json",
        };
        await updateSettings({ gistBackup: nextConfig });
        return NextResponse.json({ success: true, config: toPublicConfig({ gistBackup: nextConfig }) });
      } catch (error) {
        const launched = await launchGitHubCliRefreshWindow();
        return NextResponse.json({
          success: false,
          requiresLogin: true,
          launched,
          error: launched
            ? "Token GitHub CLI cần refresh. Hãy hoàn tất cửa sổ gh auth refresh rồi bấm lại 'Dùng GitHub CLI'."
            : "Không đọc được token từ GitHub CLI. Hãy chạy `gh auth refresh --hostname github.com --scopes gist,repo,read:org` rồi thử lại.",
          details: error?.message || "",
          config: toPublicConfig({ gistBackup: current }),
        });
      }
    }

    if (action === "disconnect") {
      const nextConfig = {
        enabled: false,
        token: "",
        tokenSource: "",
        githubLogin: "",
        gistId: "",
        htmlUrl: "",
        updatedAt: "",
        fileName: current.fileName || "xlabrouter.backup.json",
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    if (action === "backup") {
      const auth = await ensureCliAuth(current);
      const stablePassphrase = buildStableGistPassphrase({ token: auth.token, githubLogin: auth.githubLogin || current.githubLogin });
      const backup = await backupToGist({ token: auth.token, gistId: current.gistId || "", passphrase: stablePassphrase });
      const nextConfig = {
        ...current,
        enabled: true,
        token: auth.token,
        tokenSource: "gh-cli",
        githubLogin: auth.githubLogin || current.githubLogin || "",
        gistId: backup.gistId,
        htmlUrl: backup.htmlUrl,
        updatedAt: backup.updatedAt,
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, action, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    if (action === "restore") {
      const auth = await ensureCliAuth(current);
      const stablePassphrase = buildStableGistPassphrase({ token: auth.token, githubLogin: auth.githubLogin || current.githubLogin });
      const restored = await restoreFromGist({
        token: auth.token,
        gistId: current.gistId || "",
        passphrases: [stablePassphrase, auth.token],
      });
      const nextConfig = {
        ...current,
        enabled: true,
        token: auth.token,
        tokenSource: "gh-cli",
        githubLogin: auth.githubLogin || current.githubLogin || "",
        gistId: restored.gistId,
        htmlUrl: restored.htmlUrl,
        updatedAt: restored.updatedAt,
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, action, restored, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    if (action === "sync") {
      const auth = await ensureCliAuth(current);
      const stablePassphrase = buildStableGistPassphrase({ token: auth.token, githubLogin: auth.githubLogin || current.githubLogin });

      let pulled = null;
      let pullError = null;
      try {
        pulled = await restoreFromGist({
          token: auth.token,
          gistId: current.gistId || "",
          passphrases: [stablePassphrase, auth.token],
        });
      } catch (error) {
        pulled = null;
        pullError = error;
      }

      const localUpdatedAt = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
      const remoteUpdatedAt = pulled?.updatedAt ? new Date(pulled.updatedAt).getTime() : 0;

      if (!pulled || localUpdatedAt > remoteUpdatedAt) {
        const backup = await backupToGist({ token: auth.token, gistId: current.gistId || "", passphrase: stablePassphrase });
        const nextConfig = {
          ...current,
          enabled: true,
          token: auth.token,
          tokenSource: "gh-cli",
          githubLogin: auth.githubLogin || current.githubLogin || "",
          gistId: backup.gistId,
          htmlUrl: backup.htmlUrl,
          updatedAt: backup.updatedAt,
        };
        await updateSettings({ gistBackup: nextConfig });
        return NextResponse.json({
          success: true,
          action,
          direction: "push",
          config: toPublicConfig({ gistBackup: nextConfig }),
          warning: pullError?.message || "",
        });
      }

      const nextConfig = {
        ...current,
        enabled: true,
        token: auth.token,
        tokenSource: "gh-cli",
        githubLogin: auth.githubLogin || current.githubLogin || "",
        gistId: pulled.gistId,
        htmlUrl: pulled.htmlUrl,
        updatedAt: pulled.updatedAt,
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, action, direction: "pull", restored: pulled, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[gist-backup] action failed:", error);
    return NextResponse.json({ error: error.message || "GitHub Gist backup failed" }, { status: 400 });
  }
}
