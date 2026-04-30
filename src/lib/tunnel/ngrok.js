import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const NGROK_PID_FILE = path.join(os.tmpdir(), "xlabrouter-ngrok.pid");
const NGROK_RUNNING_CACHE_TTL_MS = 3000;

function getManagedNgrokPath() {
  if (os.platform() === "win32") {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
    return path.join(home, ".xlabrouter", "bin", "ngrok.exe");
  }
  const home = process.env.HOME || os.homedir();
  return path.join(home, ".xlabrouter", "bin", "ngrok");
}

let ngrokProcess = null;
let cachedNgrokRunning = null;
let cachedNgrokRunningAt = 0;
let unexpectedExitCallback = null;

function savePid(pid) {
  try {
    fs.writeFileSync(NGROK_PID_FILE, String(pid), "utf8");
  } catch (e) {
    console.error("[ngrok] Failed to save PID:", e.message);
  }
}

function loadPid() {
  try {
    if (!fs.existsSync(NGROK_PID_FILE)) return null;
    const raw = fs.readFileSync(NGROK_PID_FILE, "utf8").trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch (e) {
    return null;
  }
}

function deletePid() {
  try {
    if (fs.existsSync(NGROK_PID_FILE)) fs.unlinkSync(NGROK_PID_FILE);
  } catch (e) {}
}

export function setNgrokUnexpectedExitHandler(callback) {
  unexpectedExitCallback = callback;
}

export async function spawnNgrok(localPort, authtoken, domain = null) {
  return new Promise((resolve, reject) => {
    const ngrokBinary = process.platform === "win32" ? "ngrok.exe" : "ngrok";
    let ngrokPath = ngrokBinary;

    const managedPath = getManagedNgrokPath();
    if (fs.existsSync(managedPath)) {
      ngrokPath = managedPath;
      console.log(`[ngrok] Using managed binary: ${ngrokPath}`);
    } else {
      try {
        if (process.platform === "win32") {
          const result = execSync("where ngrok", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
          ngrokPath = result.trim().split("\\n")[0];
        } else {
          const result = execSync("which ngrok", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
          ngrokPath = result.trim();
        }
      } catch (e) {
        console.log("[ngrok] Not found in PATH, using default name");
      }
    }

    const args = ["http", String(localPort)];
    if (authtoken) {
      args.push("--authtoken", authtoken);
    }
    if (domain) {
      args.push("--domain", domain);
    }

    console.log(`[ngrok] Starting: ${ngrokPath} ${args.join(" ")}`);

    const child = spawn(ngrokPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      windowsHide: true,
    });

    ngrokProcess = child;
    savePid(child.pid);

    let resolved = false;
    let connected = false;
    let settled = false;

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      resolved = true;
      connected = true;
      try { child.unref(); } catch {}
      clearTimeout(timeout);
      clearInterval(pollInterval);
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(pollInterval);
      reject(error);
    };

    const extractTunnelUrl = (text) => {
      if (!text) return "";
      const ngrokMatch = text.match(/https:\/\/[\w.-]*ngrok[\w.-]*\/[\w\-./?=&%]*/i);
      if (ngrokMatch?.[0]) return ngrokMatch[0].replace(/["'\s]+$/, "");

      const genericMatch = text.match(/https:\/\/[\w.-]+\.[a-z]{2,}(?:\/[\w\-./?=&%]*)?/i);
      if (genericMatch?.[0] && /ngrok/i.test(genericMatch[0])) {
        return genericMatch[0].replace(/["'\s]+$/, "");
      }
      return "";
    };

    const timeout = setTimeout(() => {
      if (!settled) {
        child.kill();
        finishReject(new Error("Ngrok tunnel timed out"));
      }
    }, 30000);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("http://127.0.0.1:4040/api/tunnels");
        const data = await response.json();
        const tunnel = data.tunnels?.find(t => t.proto === "https");
        
        if (tunnel?.public_url) {
          const tunnelUrl = tunnel.public_url;

          if (!settled) {
            console.log(`[ngrok] Tunnel connected: ${tunnelUrl}`);
            finishResolve({ child, tunnelUrl });
          }
        }
      } catch (e) {}
    }, 500);

    child.stdout.on("data", (data) => {
      const text = data.toString();
      console.log(`[ngrok stdout] ${text}`);
      if (!settled) {
        const tunnelUrl = extractTunnelUrl(text);
        if (tunnelUrl) {
          console.log(`[ngrok] Tunnel connected from stdout: ${tunnelUrl}`);
          finishResolve({ child, tunnelUrl });
        }
      }
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      console.log(`[ngrok stderr] ${text}`);
      if (!settled) {
        const tunnelUrl = extractTunnelUrl(text);
        if (tunnelUrl) {
          console.log(`[ngrok] Tunnel connected from stderr: ${tunnelUrl}`);
          finishResolve({ child, tunnelUrl });
          return;
        }
      }

      if (!settled && /(failed|error|invalid|authtoken|authentication|ERR_NGROK)/i.test(text)) {
        child.kill();
        finishReject(new Error(text.trim() || "Ngrok failed to start"));
      }
    });

    child.on("error", (error) => {
      deletePid();
      ngrokProcess = null;
      cachedNgrokRunning = false;
      cachedNgrokRunningAt = Date.now();

      if (error?.code === "ENOENT") {
        finishReject(new Error("Ngrok binary not found. Please install ngrok or add it to PATH."));
        return;
      }

      finishReject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      clearInterval(pollInterval);
      deletePid();
      ngrokProcess = null;
      cachedNgrokRunning = false;
      cachedNgrokRunningAt = Date.now();

      if (connected && unexpectedExitCallback) {
        console.log(`[ngrok] Unexpected exit (code ${code})`);
        unexpectedExitCallback();
      } else if (!settled) {
        finishReject(new Error(`ngrok exited with code ${code}`));
      }
    });
  });
}

export function killNgrok() {
  console.log("[ngrok] Killing ngrok process...");
  cachedNgrokRunning = false;
  cachedNgrokRunningAt = Date.now();

  if (ngrokProcess) {
    try {
      ngrokProcess.kill();
    } catch (e) {}
    ngrokProcess = null;
  }

  deletePid();

  try {
    if (process.platform === "win32") {
      execSync("taskkill /F /IM ngrok.exe 2>nul || exit 0", { stdio: "ignore", windowsHide: true, timeout: 3000 });
    } else {
      execSync("pkill -f ngrok 2>/dev/null || true", { stdio: "ignore", windowsHide: true, timeout: 3000 });
    }
  } catch (e) {}
}

export function isNgrokRunning() {
  if (cachedNgrokRunning !== null && Date.now() - cachedNgrokRunningAt < NGROK_RUNNING_CACHE_TTL_MS) {
    return cachedNgrokRunning;
  }

  const pid = loadPid();
  if (!pid) {
    cachedNgrokRunning = false;
    cachedNgrokRunningAt = Date.now();
    return false;
  }
  try {
    process.kill(pid, 0);
    cachedNgrokRunning = true;
    cachedNgrokRunningAt = Date.now();
    return true;
  } catch (e) {
    cachedNgrokRunning = false;
    cachedNgrokRunningAt = Date.now();
    return false;
  }
}
