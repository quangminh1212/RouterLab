#!/usr/bin/env node

const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const inquirer = require("inquirer").default || require("inquirer");
const https = require("https");

const LOG_FILE_NAME = "log.txt";
const MAX_LOG_SIZE_BYTES = 100 * 1024 * 1024;
const DEFAULT_HOSTNAME = process.env.HOSTNAME || process.env.XLABROUTER_HOSTNAME || "::";

function setupFileLogging() {
  const repoRoot = path.resolve(__dirname, "..");
  const logFilePath = path.join(repoRoot, LOG_FILE_NAME);

  try {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size >= MAX_LOG_SIZE_BYTES) {
        fs.unlinkSync(logFilePath);
      }
    }
  } catch (error) {
    process.stderr.write(`[WARN] Failed to rotate log file: ${error.message}\n`);
  }

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  function enforceLogLimit(extraBytes = 0) {
    try {
      const currentSize = fs.existsSync(logFilePath) ? fs.statSync(logFilePath).size : 0;
      if (currentSize + extraBytes < MAX_LOG_SIZE_BYTES) {
        return true;
      }

      fs.unlinkSync(logFilePath);
      return true;
    } catch (error) {
      originalStderrWrite(`[WARN] Failed to reset log file: ${error.message}\n`);
      return false;
    }
  }

  function writeToLog(chunk, encoding) {
    const resolvedEncoding = typeof encoding === "string" ? encoding : "utf8";
    const content = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), resolvedEncoding);
    if (!enforceLogLimit(content.length)) {
      return;
    }

    try {
      fs.appendFileSync(logFilePath, content);
    } catch (error) {
      originalStderrWrite(`[WARN] Failed to write log file: ${error.message}\n`);
    }
  }

  process.stdout.write = (chunk, encoding, callback) => {
    writeToLog(chunk, encoding);
    return originalStdoutWrite(chunk, encoding, callback);
  };

  process.stderr.write = (chunk, encoding, callback) => {
    writeToLog(chunk, encoding);
    return originalStderrWrite(chunk, encoding, callback);
  };

  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));
}

setupFileLogging();

const command = process.argv[2];
const port = process.env.PORT || 20128;
const hostname = DEFAULT_HOSTNAME;

if (command === "--version" || command === "-v") {
  console.log(pkg.version);
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log("xlab_router - XLab Router CLI");
  console.log("");
  console.log("Usage:");
  console.log("  xlab_router           Show interactive menu");
  console.log("  xlab_router --web     Start Web UI directly (port 20128)");
  console.log("  xlab_router --tray    Start in system tray mode");
  console.log("  xlab_router --version Show version");
  console.log("");
  console.log("Environment:");
  console.log("  PORT=<port>          Override default port");
  console.log("  HOSTNAME=<host>      Override bind host (default: ::)");
  process.exit(0);
}

function execCommand(commandText) {
  return new Promise((resolve) => {
    exec(commandText, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPidsOnPort(targetPort) {
  const isWin = process.platform === "win32";
  const commandText = isWin
    ? `powershell -Command "Get-NetTCPConnection -LocalPort ${targetPort} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique"`
    : `lsof -ti:${targetPort}`;
  const { stdout } = await execCommand(commandText);
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
}

async function waitForPortToClear(targetPort, retries = 20, delayMs = 250) {
  for (let index = 0; index < retries; index += 1) {
    const pids = await getPidsOnPort(targetPort);
    if (pids.length === 0) {
      return true;
    }
    await sleep(delayMs);
  }
  return false;
}

async function killProcessOnPort(targetPort) {
  const pids = await getPidsOnPort(targetPort);
  if (pids.length === 0) {
    return [];
  }

  const killedPids = [];
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
      killedPids.push(pid);
    } catch (_) {
    }
  }

  await sleep(500);

  const remainingPids = await getPidsOnPort(targetPort);
  for (const pid of remainingPids) {
    try {
      process.kill(pid, "SIGKILL");
      if (!killedPids.includes(pid)) {
        killedPids.push(pid);
      }
    } catch (_) {
    }
  }

  const isCleared = await waitForPortToClear(targetPort);
  if (!isCleared) {
    throw new Error(`Port ${targetPort} is still busy after stopping old processes.`);
  }

  return killedPids;
}

async function startWebUI() {
  const nextBin = require.resolve("next/dist/bin/next");
  const repoRoot = path.resolve(__dirname, "..");

  const requestedMode = (process.env.XLABROUTER_WEB_MODE || "auto").toLowerCase();
  const isNonInteractive = !process.stdout.isTTY;
  const runProd = requestedMode === "production"
    || requestedMode === "prod"
    || (requestedMode === "auto" && isNonInteractive);
  const modeLabel = runProd ? "production" : "development";

  console.log(`\n[INFO] Starting XLab Router Web UI on ${hostname}:${port} (${modeLabel})...`);

  const killedPids = await killProcessOnPort(port);
  if (killedPids.length > 0) {
    console.log(`[INFO] Stopped old process(es) on port ${port}: ${killedPids.join(", ")}`);
  }

  console.log(`[INFO] Visit http://localhost:${port}`);
  console.log(`[INFO] Logging to ${path.resolve(__dirname, "..", LOG_FILE_NAME)} (auto-delete at 100MB)`);
  console.log(`[INFO] Press Ctrl+C to stop\n`);

  if (runProd) {
    const buildIdPath = path.join(repoRoot, ".next", "BUILD_ID");
    if (!fs.existsSync(buildIdPath)) {
      console.log("[INFO] Production build not found. Running one-time build...");
      const build = spawn(process.execPath, [nextBin, "build", "--webpack"], {
        cwd: repoRoot,
        stdio: "inherit",
      });

      await new Promise((resolve, reject) => {
        build.on("error", reject);
        build.on("exit", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Build failed with exit code ${code || 1}`));
        });
      });
    }
  }

  let nextArgs;
  if (runProd) {
    const standaloneServerPath = path.join(repoRoot, ".next", "standalone", "server.js");
    if (fs.existsSync(standaloneServerPath)) {
      nextArgs = [standaloneServerPath];
      process.env.PORT = String(port);
      process.env.HOSTNAME = hostname;
    } else {
      nextArgs = [nextBin, "start", "--hostname", hostname, "--port", String(port)];
    }
  } else {
    nextArgs = [nextBin, "dev", "--webpack", "--hostname", hostname, "--port", String(port)];
  }

  const child = spawn(process.execPath, nextArgs, {
    cwd: repoRoot,
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
  }

  child.on("error", (err) => {
    console.error("[ERROR] Failed to start XLab Router:", err);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

function startTrayMode() {
  console.log(`\n[INFO] Starting XLab Router in system tray mode...`);
  console.log(`[WARN] System tray mode is not yet implemented.`);
  console.log(`[INFO] Falling back to Web UI mode...\n`);
  startWebUI();
}

function checkForUpdates() {
  return new Promise((resolve) => {
    console.log(`\n[INFO] Checking for updates...`);
    console.log(`[INFO] Current version: ${pkg.version}`);

    const options = {
      hostname: "registry.npmjs.org",
      path: `/${pkg.name}`,
      method: "GET",
      headers: { "User-Agent": "xlab_router" },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const latestVersion = json["dist-tags"]?.latest;
          if (latestVersion) {
            console.log(`[INFO] Latest version: ${latestVersion}`);
            if (latestVersion !== pkg.version) {
              console.log(`[WARN] New version available! Run: npm install -g ${pkg.name}`);
            } else {
              console.log(`[OK] You are using the latest version.`);
            }
          } else {
            console.log(`[WARN] Could not determine latest version.`);
          }
        } catch (e) {
          console.log(`[WARN] Failed to parse version info.`);
        }
        resolve();
      });
    });

    req.on("error", () => {
      console.log(`[WARN] Could not check for updates (network error).`);
      resolve();
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`[WARN] Update check timed out.`);
      resolve();
    });

    req.end();
  });
}

async function showServerSettings() {
  console.log(`\n========================================`);
  console.log(`       Server Settings`);
  console.log(`========================================\n`);
  console.log(`[INFO] Current port: ${port}`);
  console.log(`[INFO] To change port, set PORT environment variable.`);
  console.log(`[INFO] Example: PORT=3000 xlab_router\n`);

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "Back to Main Menu", value: "back" },
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  if (action === "back") {
    await showMenu();
  } else {
    console.log("\n[INFO] Goodbye!\n");
    process.exit(0);
  }
}

async function showMenu() {
  console.clear();
  console.log("========================================");
  console.log("       XLab Router v" + pkg.version);
  console.log("========================================\n");

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "interface",
      message: "Choose Interface:",
      choices: [
        { name: "Web UI (Browser Interface)", value: "web" },
        { name: "Terminal UI (Coming Soon)", value: "terminal", disabled: true },
        { name: "Hide to Tray (System Tray)", value: "tray" },
        new inquirer.Separator(),
        { name: "Check for Updates", value: "update" },
        { name: "Server Settings", value: "settings" },
        new inquirer.Separator(),
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  switch (answers.interface) {
    case "web":
      startWebUI();
      break;
    case "tray":
      startTrayMode();
      break;
    case "update":
      await checkForUpdates();
      console.log("");
      await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      await showMenu();
      break;
    case "settings":
      await showServerSettings();
      break;
    case "exit":
      console.log("\n[INFO] Goodbye!\n");
      process.exit(0);
      break;
    default:
      console.log("\n[ERROR] Invalid choice\n");
      process.exit(1);
  }
}

// Handle direct launch modes
if (command === "--web") {
  startWebUI();
} else if (command === "--tray") {
  startTrayMode();
} else {
  // Show interactive menu
  showMenu().catch((err) => {
    console.error("[ERROR] Menu failed:", err);
    process.exit(1);
  });
}
