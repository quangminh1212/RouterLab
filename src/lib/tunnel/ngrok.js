import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const NGROK_PID_FILE = path.join(os.tmpdir(), "xlabrouter-ngrok.pid");
const NGROK_RUNNING_CACHE_TTL_MS = 3000;

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

    try {
      if (process.platform === "win32") {
        const result = execSync("where ngrok", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
        ngrokPath = result.trim().split("\\n")[0];
      } else {
        const result = execSync("which ngrok", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
        ngrokPath = result.trim();
      }
    } catch (e) {
      console.log("[ngrok] Not found in PATH, using default name");
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
      detached: false,
      windowsHide: true,
    });

    ngrokProcess = child;
    savePid(child.pid);

    let resolved = false;
    let connected = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error("Ngrok tunnel timed out"));
      }
    }, 30000);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("http://127.0.0.1:4040/api/tunnels");
        const data = await response.json();
        const tunnel = data.tunnels?.find(t => t.proto === "https");
        
        if (tunnel?.public_url) {
          const tunnelUrl = tunnel.public_url;
          
          if (!resolved) {
            clearTimeout(timeout);
            clearInterval(pollInterval);
            resolved = true;
            connected = true;
            console.log(`[ngrok] Tunnel connected: ${tunnelUrl}`);
            resolve({ child, tunnelUrl });
          }
        }
      } catch (e) {}
    }, 500);

    child.stdout.on("data", (data) => {
      console.log(`[ngrok stdout] ${data.toString()}`);
    });

    child.stderr.on("data", (data) => {
      console.log(`[ngrok stderr] ${data.toString()}`);
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
      } else if (!resolved) {
        reject(new Error(`ngrok exited with code ${code}`));
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
