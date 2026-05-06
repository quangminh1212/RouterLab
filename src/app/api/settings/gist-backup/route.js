import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { backupToGist, restoreFromGist } from "@/lib/gistBackup";

const execFileAsync = promisify(execFile);

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
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "XLab-Router",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

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
      const token = await getGitHubCliToken();
      return {
        token,
        githubLogin: await resolveGitHubLogin(token, storedLogin),
      };
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
  const token = await getGitHubCliToken();
  return {
    token,
    githubLogin: await resolveGitHubLogin(token, storedLogin),
  };
}

async function launchGitHubCliLoginWindow() {
  try {
    await execFileAsync("powershell.exe", [
      "-Command",
      "Start-Process -FilePath powershell.exe -ArgumentList '-NoExit','-Command','gh auth login --hostname github.com --web --git-protocol https --scopes gist,repo,read:org'",
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
        const token = await getGitHubCliToken();
        const githubLogin = await resolveGitHubLogin(token, current.githubLogin || "");
        const nextConfig = {
          ...current,
          enabled: true,
          token,
          tokenSource: "gh-cli",
          githubLogin,
          fileName: current.fileName || "xlabrouter.backup.json",
        };
        await updateSettings({ gistBackup: nextConfig });
        return NextResponse.json({ success: true, config: toPublicConfig({ gistBackup: nextConfig }) });
      } catch (error) {
        const launched = await launchGitHubCliLoginWindow();
        return NextResponse.json({
          success: false,
          requiresLogin: true,
          launched,
          error: launched
            ? "Kh?ng ??c ???c token t? GitHub CLI. ?? m? c?a s? ??ng nh?p, h?y ho?n t?t r?i b?m l?i 'D?ng GitHub CLI'."
            : "Kh?ng ??c ???c token t? GitHub CLI. H?y ch?y `gh auth login --hostname github.com --web --git-protocol https --scopes gist,repo,read:org` r?i th? l?i.",
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
