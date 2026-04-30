import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { NextResponse } from "next/server";
import { DATA_DIR } from "@/lib/dataDir.js";

const EXTENDED_PATH = `/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${process.env.PATH || ""}`;
const IS_WINDOWS = os.platform() === "win32";
const LOCAL_TAILSCALE_BIN = path.join(DATA_DIR, "bin", IS_WINDOWS ? "tailscale.exe" : "tailscale");
const TAILSCALE_SOCKET = path.join(DATA_DIR, "tailscale", "tailscaled.sock");

function getTailscaleBin() {
  try {
    const systemPath = execSync("which tailscale 2>/dev/null || where tailscale 2>nul", {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
    if (systemPath) return systemPath;
  } catch {
    // ignore lookup errors
  }

  if (fs.existsSync(LOCAL_TAILSCALE_BIN)) return LOCAL_TAILSCALE_BIN;

  if (IS_WINDOWS && process.env.ProgramFiles) {
    const programFilesBin = path.join(process.env.ProgramFiles, "Tailscale", "tailscale.exe");
    if (fs.existsSync(programFilesBin)) return programFilesBin;
  }

  return null;
}

function isTailscaleInstalled() {
  return getTailscaleBin() !== null;
}

function isTailscaleLoggedIn() {
  const bin = getTailscaleBin();
  if (!bin) return false;

  if (IS_WINDOWS) {
    try {
      const out = execSync(`"${bin}" status`, {
        encoding: "utf8",
        windowsHide: true,
        timeout: 3000,
      });
      return out.trim().length > 0 && !/logged out|not logged in/i.test(out);
    } catch {
      return false;
    }
  }

  try {
    const out = execSync(`"${bin}" --socket "${TAILSCALE_SOCKET}" status --json`, {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, PATH: EXTENDED_PATH },
      timeout: 5000,
    });
    const json = JSON.parse(out);
    return json.BackendState === "Running";
  } catch {
    return false;
  }
}

function hasBrew() {
  try { execSync("which brew", { stdio: "ignore", windowsHide: true, env: { ...process.env, PATH: EXTENDED_PATH } }); return true; } catch { return false; }
}

function isDaemonRunning() {
  const platform = os.platform();
  if (platform === "win32") {
    try {
      execSync("sc query Tailscale | findstr /I RUNNING", {
        stdio: "ignore",
        windowsHide: true,
        timeout: 2000
      });
      return true;
    } catch {
      return false;
    }
  }
  try {
    // Windows does not use custom unix socket; other OS use userspace socket.
    const statusCmd = `tailscale --socket ${TAILSCALE_SOCKET} status --json`;
    execSync(statusCmd, {
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, PATH: EXTENDED_PATH },
      timeout: 3000
    });
    return true;
  } catch {
    // Fallback: check if tailscaled process is alive
    try {
      if (platform === "win32") {
        execSync("sc query Tailscale | findstr /I RUNNING", { stdio: "ignore", windowsHide: true, timeout: 2000 });
      } else {
        execSync("pgrep -x tailscaled", { stdio: "ignore", windowsHide: true, timeout: 2000 });
      }
      return true;
    } catch { return false; }
  }
}

export async function GET() {
  try {
    const installed = isTailscaleInstalled();
    const platform = os.platform();
    const brewAvailable = platform === "darwin" && hasBrew();
    const daemonRunning = installed ? isDaemonRunning() : false;
    const loggedIn = daemonRunning ? isTailscaleLoggedIn() : false;
    return NextResponse.json({ installed, loggedIn, platform, brewAvailable, daemonRunning });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
