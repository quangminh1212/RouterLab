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
    fileName: gistBackup.fileName || "xlabrouter.enc.json",
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
    throw new Error("GitHub token is invalid or missing required access");
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

async function ensureCliAuth(current) {
  if (current?.token) {
    return {
      token: current.token,
      githubLogin: current.githubLogin || "",
    };
  }

  const token = await getGitHubCliToken();
  const user = await validateGitHubToken(token);
  return {
    token,
    githubLogin: user.login || "",
  };
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
      const token = await getGitHubCliToken();
      const gitHubUser = await validateGitHubToken(token);
      const nextConfig = {
        ...current,
        enabled: true,
        token,
        tokenSource: "gh-cli",
        githubLogin: gitHubUser.login || current.githubLogin || "",
        fileName: current.fileName || "xlabrouter.enc.json",
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, config: toPublicConfig({ gistBackup: nextConfig }) });
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
        fileName: current.fileName || "xlabrouter.enc.json",
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
      try {
        pulled = await restoreFromGist({
          token: auth.token,
          gistId: current.gistId || "",
          passphrases: [stablePassphrase, auth.token],
        });
      } catch {
        pulled = null;
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
        return NextResponse.json({ success: true, action, direction: "push", config: toPublicConfig({ gistBackup: nextConfig }) });
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
    return NextResponse.json({ error: error.message || "GitHub Gist backup failed" }, { status: 400 });
  }
}
