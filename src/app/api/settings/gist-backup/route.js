import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSettings, updateSettings } from "@/lib/localDb";
import { backupToGist, restoreFromGist } from "@/lib/gistBackup";

const execFileAsync = promisify(execFile);

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "xlabrouter-default-secret-change-me"
);

async function hasValidAuth(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
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
    fileName: gistBackup.fileName || "xlabrouter-backup.enc.json",
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

export async function GET(request) {
  try {
    if (!await hasValidAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const settings = await getSettings();
    return NextResponse.json(toPublicConfig(settings));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load Gist backup settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!await hasValidAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        gistId: typeof body.gistId === "string" ? body.gistId.trim() : current.gistId || "",
        fileName: current.fileName || "xlabrouter-backup.enc.json",
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    if (action === "save-config") {
      const incomingToken = typeof body.token === "string" ? body.token.trim() : "";
      const tokenToUse = incomingToken || current.token || "";
      let githubLogin = current.githubLogin || "";
      if (incomingToken) {
        const gitHubUser = await validateGitHubToken(incomingToken);
        githubLogin = gitHubUser.login || "";
      }

      const nextConfig = {
        ...current,
        enabled: body.enabled !== false,
        token: tokenToUse,
        tokenSource: incomingToken ? "manual" : current.tokenSource || "",
        githubLogin,
        gistId: typeof body.gistId === "string" ? body.gistId.trim() : current.gistId || "",
        fileName: typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim() : current.fileName || "xlabrouter-backup.enc.json",
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
        fileName: current.fileName || "xlabrouter-backup.enc.json",
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    const token = (current.token || "").trim();
    const gistId = (current.gistId || "").trim();
    const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";

    if (!token) {
      return NextResponse.json({ error: "GitHub token is not configured" }, { status: 400 });
    }

    if (action === "backup") {
      const backup = await backupToGist({ token, gistId, passphrase });
      const nextConfig = {
        ...current,
        enabled: true,
        gistId: backup.gistId,
        htmlUrl: backup.htmlUrl,
        updatedAt: backup.updatedAt,
      };
      await updateSettings({ gistBackup: nextConfig });
      return NextResponse.json({ success: true, action, config: toPublicConfig({ gistBackup: nextConfig }) });
    }

    if (action === "restore") {
      if (!gistId) {
        return NextResponse.json({ error: "No backup Gist connected yet" }, { status: 400 });
      }
      const restored = await restoreFromGist({ token, gistId, passphrase });
      return NextResponse.json({ success: true, action, restored, config: toPublicConfig(settings) });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "GitHub Gist backup failed" }, { status: 400 });
  }
}
