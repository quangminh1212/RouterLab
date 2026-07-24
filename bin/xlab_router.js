#!/usr/bin/env node

// Initialize graceful shutdown handlers when the packaged runtime includes them.
try {
  require('../src/lib/gracefulShutdown');
} catch (error) {
  if (error?.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const pkg = require("../package.json");
const inquirer = require("inquirer").default || require("inquirer");
const https = require("https");

const LOG_FILE_NAME = "log.txt";
const MAX_LOG_SIZE_BYTES = 100 * 1024 * 1024;
const DEFAULT_HOSTNAME = process.env.HOSTNAME || process.env.XLABROUTER_HOSTNAME || "0.0.0.0";

// CLIProxyAPI parity: optional Redis RESP usage queue (env REDIS_USAGE_QUEUE_PORT)
try {
  if (process.env.REDIS_USAGE_QUEUE_PORT) {
    // Lazy ESM import from CJS entry
    import("open-sse/services/redisUsageQueue.js")
      .then((m) => m.startRedisUsageQueue())
      .then((info) => {
        if (info?.port) console.log(`[INFO] Redis RESP usage queue on :${info.port}`);
      })
      .catch((err) => {
        console.log(`[WARN] Redis RESP usage queue failed: ${err.message}`);
      });
  }
} catch (error) {
  console.log(`[WARN] Redis RESP usage queue init error: ${error.message}`);
}
function readRamConfig() {
  try {
    const configPath = path.join(__dirname, "..", ".ram-config.json");
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(data);
      return config.ram || 2048;
    }
  } catch (error) {
    // Ignore errors, use default
  }
  return 2048;
}

function copyDirectoryIfExists(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function shouldSkipCopyPath(sourceDir, itemPath) {
  const relative = path.relative(sourceDir, itemPath);
  if (!relative) {
    return false;
  }

  const normalized = relative.replace(/\\/g, "/");
  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) {
    return true;
  }
  if (normalized === ".next" || normalized.startsWith(".next/")) {
    return true;
  }
  if (normalized === ".git" || normalized.startsWith(".git/")) {
    return true;
  }
  if (normalized.startsWith(".tmp-") || normalized.endsWith(".tgz")) {
    return true;
  }
  return false;
}

function copyProjectFiles(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const queue = [{ src: sourceDir, dst: targetDir }];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current.src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(current.src, entry.name);
      if (shouldSkipCopyPath(sourceDir, srcPath)) {
        continue;
      }

      const dstPath = path.join(current.dst, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        fs.mkdirSync(dstPath, { recursive: true });
        queue.push({ src: srcPath, dst: dstPath });
        continue;
      }

      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function ensureWorkspaceRoot(repoRoot) {
  const normalizedRepoRoot = repoRoot.replace(/\\/g, "/").toLowerCase();
  const inNodeModules = normalizedRepoRoot.includes("/node_modules/xlabrouter");

  const sourceNodeModulesCandidates = inNodeModules
    ? [
      path.join(repoRoot, "node_modules"),
      path.resolve(repoRoot, ".."),
      path.resolve(repoRoot, "..", "..", "node_modules"),
    ]
    : [
      path.join(repoRoot, "node_modules"),
    ];

  const existingNodeModuleDirs = sourceNodeModulesCandidates
    .filter((candidate) => fs.existsSync(candidate))
    .filter((candidate, index, arr) => arr.indexOf(candidate) === index);

  if (existingNodeModuleDirs.length === 0) {
    throw new Error("Cannot locate node_modules for runtime workspace.");
  }

  const sourceNodeModules = existingNodeModuleDirs.join(path.delimiter);

  if (!inNodeModules) {
    return { appRoot: repoRoot, sourceNodeModules };
  }

  const installRoot = path.resolve(repoRoot, "..", "..");
  const workspaceRoot = path.join(installRoot, ".xlabrouter-runtime", pkg.version);
  const stampFile = path.join(workspaceRoot, ".runtime-stamp");
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJsonMtime = fs.existsSync(packageJsonPath)
    ? String(fs.statSync(packageJsonPath).mtimeMs)
    : "0";
  const expectedStamp = `${pkg.version}:${repoRoot}:${packageJsonMtime}`;
  const currentStamp = fs.existsSync(stampFile) ? fs.readFileSync(stampFile, "utf8") : "";

  if (currentStamp !== expectedStamp) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
    copyProjectFiles(repoRoot, workspaceRoot);
    fs.writeFileSync(stampFile, expectedStamp, "utf8");
  }

  return { appRoot: workspaceRoot, sourceNodeModules };
}

function getRuntimeDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "xlabrouter");
  }
  return path.join(os.homedir(), ".xlabrouter");
}

function safeStatMs(targetPath) {
  try {
    return fs.statSync(targetPath).mtimeMs || 0;
  } catch {
    return 0;
  }
}

function getDirectorySizeBytes(targetPath) {
  try {
    return (fs.readdirSync(targetPath, { withFileTypes: true }) || []).reduce((sum, entry) => {
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) return sum + getDirectorySizeBytes(fullPath);
      try {
        return sum + fs.statSync(fullPath).size;
      } catch {
        return sum;
      }
    }, 0);
  } catch {
    return 0;
  }
}

function removePathQuietly(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 2 });
    return true;
  } catch {
    return false;
  }
}

function ensureDirQuietly(targetPath) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
  } catch {}
}

function runAutoCleanup(appRoot) {
  const now = Date.now();
  const stateFile = path.join(getRuntimeDataDir(), "cleanup-state.json");
  const runIntervalMs = 12 * 60 * 60 * 1000;

  try {
    const state = fs.existsSync(stateFile)
      ? JSON.parse(fs.readFileSync(stateFile, "utf8"))
      : {};
    if (state.lastRunAt && now - Number(state.lastRunAt) < runIntervalMs) {
      return;
    }
  } catch {}

  const repoRoot = appRoot;
  const cleanupReport = {
    freedBytes: 0,
    deleted: [],
  };

  const deleteIfOlderThan = (targetPath, maxAgeMs) => {
    if (!fs.existsSync(targetPath)) return;
    if (now - safeStatMs(targetPath) < maxAgeMs) return;
    const sizeBytes = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
      ? getDirectorySizeBytes(targetPath)
      : (() => { try { return fs.statSync(targetPath).size; } catch { return 0; } })();
    if (removePathQuietly(targetPath)) {
      cleanupReport.freedBytes += sizeBytes;
      cleanupReport.deleted.push(path.relative(repoRoot, targetPath) || targetPath);
    }
  };

  const removeOldChildren = (baseDir, matcher, maxAgeMs) => {
    if (!fs.existsSync(baseDir)) return;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      const targetPath = path.join(baseDir, entry.name);
      if (!matcher(entry.name, entry)) continue;
      deleteIfOlderThan(targetPath, maxAgeMs);
    }
  };

  try {
    removeOldChildren(path.join(appRoot, ".next"), (name, entry) => entry.isDirectory() && (name === "cache" || name === "dev"), 3 * 24 * 60 * 60 * 1000);
    removeOldChildren(repoRoot, (name, entry) => {
      if (entry.isDirectory()) return name.startsWith(".tmp-") || name === ".tmp-global-test" || name === "test-results";
      return /^\.tmp-.*|^tmp_.*|\.tgz$/i.test(name) || /^next-dev.*\.log$/i.test(name) || /^bench_.*\.log$/i.test(name);
    }, 2 * 24 * 60 * 60 * 1000);
    removeOldChildren(path.join(repoRoot, "logs"), () => true, 7 * 24 * 60 * 60 * 1000);

    const worktreesDir = path.join(repoRoot, ".claude", "worktrees");
    if (fs.existsSync(worktreesDir)) {
      for (const entry of fs.readdirSync(worktreesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const targetPath = path.join(worktreesDir, entry.name);
        if (now - safeStatMs(targetPath) < 7 * 24 * 60 * 60 * 1000) continue;
        const gitDir = path.join(targetPath, ".git");
        if (!fs.existsSync(gitDir)) {
          deleteIfOlderThan(targetPath, 7 * 24 * 60 * 60 * 1000);
        }
      }
    }
  } catch (error) {
    process.stderr.write(`[WARN] Auto cleanup failed: ${error.message}\n`);
  }

  try {
    ensureDirQuietly(path.dirname(stateFile));
    fs.writeFileSync(stateFile, JSON.stringify({ lastRunAt: now, freedBytes: cleanupReport.freedBytes, deleted: cleanupReport.deleted.slice(0, 50) }, null, 2), "utf8");
  } catch {}

  if (cleanupReport.freedBytes > 0) {
    const freedMb = Math.round(cleanupReport.freedBytes / 1024 / 1024);
    console.log(`[INFO] Auto cleanup freed ${freedMb} MB.`);
  }
}

function setupFileLogging() {
  const logFilePath = getLogFilePath();

  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  } catch (error) {
    process.stderr.write(`[WARN] Failed to ensure log directory: ${error.message}\n`);
  }

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

  let logStream = null;
  let bufferedBytes = fs.existsSync(logFilePath) ? fs.statSync(logFilePath).size : 0;

  function ensureStream() {
    if (logStream) return;
    logStream = fs.createWriteStream(logFilePath, { flags: "a" });
    logStream.on("error", (error) => {
      originalStderrWrite(`[WARN] Failed to write log file: ${error.message}\n`);
      try { logStream?.destroy(); } catch {}
      logStream = null;
    });
  }

  function rotateLogFile() {
    try {
      if (logStream) {
        try { logStream.end(); } catch {}
        logStream = null;
      }
      if (fs.existsSync(logFilePath)) {
        fs.unlinkSync(logFilePath);
      }
      bufferedBytes = 0;
      ensureStream();
      return true;
    } catch (error) {
      originalStderrWrite(`[WARN] Failed to reset log file: ${error.message}\n`);
      return false;
    }
  }

  function writeToLog(chunk, encoding) {
    const resolvedEncoding = typeof encoding === "string" ? encoding : "utf8";
    const content = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), resolvedEncoding);

    if (bufferedBytes + content.length >= MAX_LOG_SIZE_BYTES) {
      if (!rotateLogFile()) return;
    }

    ensureStream();
    if (!logStream) return;

    bufferedBytes += content.length;
    if (!logStream.write(content)) {
      // Let Node backpressure internally; stdout/stderr still continue without sync disk blocking.
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

  process.on("exit", () => {
    try { logStream?.end(); } catch {}
  });
}

setupFileLogging();

const command = process.argv[2];
const port = process.env.PORT || 1212;
const hostname = DEFAULT_HOSTNAME;

if (command === "--version" || command === "-v") {
  console.log(pkg.version);
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log("xlab_router - XLab Router CLI");
  console.log("");
  console.log("Usage:");
  console.log("  xlab_router           Start Web UI directly (port 1212)");
  console.log("  xlab_router --tray    Start in system tray/background mode");
  console.log("  xlab_router --web     Start Web UI directly (port 1212)");
  console.log("  xlab_router --autostart-on      Enable Windows autostart in tray mode");
  console.log("  xlab_router --autostart-off     Disable Windows autostart");
  console.log("  xlab_router --autostart-status  Show Windows autostart status");
  console.log("  xlab_router --menu    Show interactive menu");
  console.log("  xlab_router --version Show version");
  console.log("");
  console.log("Install:");
  console.log("  npm i -g xlabrouter         Install global command");
  console.log("  npx xlabrouter              Run without global install");
  console.log("  npm install xlabrouter      Local install; run with npx xlabrouter");
  console.log("");
  console.log("Compatibility aliases:");
  console.log("  omniroute, 9router, cliproxyapi, xrouter");
  console.log("");
  console.log("Environment:");
  console.log("  PORT=<port>          Override default port");
  console.log("  HOSTNAME=<host>      Override bind host (default: 0.0.0.0)");
  process.exit(0);
}

function execCommand(commandText) {
  return new Promise((resolve) => {
    exec(commandText, { windowsHide: true }, (error, stdout, stderr) => {
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

function escapePowerShellString(value) {
  return String(value).replace(/'/g, "''");
}

async function getXLabRouterPids(repoRoot) {
  const isWin = process.platform === "win32";

  if (isWin) {
    const escapedRepoRoot = escapePowerShellString(repoRoot);
    const commandText = `powershell -Command "$repoRoot = '${escapedRepoRoot}'; $repoRegex = [regex]::Escape($repoRoot); Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne ${process.pid} -and ($_.Name -eq 'node.exe' -or $_.Name -eq 'nodew.exe') -and $_.CommandLine -and $_.CommandLine -match $repoRegex -and ($_.CommandLine -match 'xlab_router\\.js' -or $_.CommandLine -match '\\.next[\\/]+standalone[\\/]+server\\.js') } | Select-Object -ExpandProperty ProcessId | Sort-Object -Unique"`;
    const { stdout } = await execCommand(commandText);
    return String(stdout || "")
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  }

  const { stdout } = await execCommand("ps -ax -o pid= -o command=");
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      if (!match) return null;
      const pid = Number.parseInt(match[1], 10);
      const commandLine = match[2] || "";
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
      if (!commandLine.includes(repoRoot)) return null;
      if (!commandLine.includes("xlab_router.js") && !commandLine.includes("/.next/standalone/server.js")) return null;
      return pid;
    })
    .filter((pid) => Number.isInteger(pid));
}

async function stopOldXLabRouterProcesses(targetPort, repoRoot) {
  const portPids = await getPidsOnPort(targetPort);
  const routerPids = await getXLabRouterPids(repoRoot);
  const pids = [...new Set([...portPids, ...routerPids])].filter((pid) => pid !== process.pid);
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

  const remainingRouterPids = await getXLabRouterPids(repoRoot);
  const remainingPortPids = await getPidsOnPort(targetPort);
  const remainingPids = [...new Set([...remainingRouterPids, ...remainingPortPids])].filter((pid) => pids.includes(pid));
  for (const pid of remainingPids) {
    try {
      process.kill(pid, "SIGKILL");
      if (!killedPids.includes(pid)) {
        killedPids.push(pid);
      }
    } catch (_) {
    }
  }

  const isPortCleared = await waitForPortToClear(targetPort);
  if (!isPortCleared) {
    throw new Error(`Port ${targetPort} is still busy after stopping old processes.`);
  }

  const leftoverRouterPids = await getXLabRouterPids(repoRoot);
  if (leftoverRouterPids.length > 0) {
    throw new Error(`Old XLab Router process is still running: ${leftoverRouterPids.join(", ")}`);
  }

  return killedPids;
}

async function warmupRoutes(baseUrl) {
  const warmupFlag = (process.env.XLABROUTER_WARMUP || "").trim();
  const enabled = warmupFlag !== "0";
  if (!enabled) {
    return;
  }

  const startedAt = Date.now();
  const targets = [
    { method: "GET", path: "/login" },
    { method: "GET", path: "/api/settings" },
    { method: "GET", path: "/api/tunnel/status" },
    { method: "GET", path: "/api/proxy/systems/list" },
    {
      method: "POST",
      path: "/api/auth/login",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "warmup", password: "warmup" }),
    },
  ];

  await Promise.allSettled(
    targets.map((target) =>
      fetch(`${baseUrl}${target.path}`, {
        method: target.method,
        headers: target.headers,
        body: target.body,
      })
    )
  );

  console.log(`[INFO] Warmup completed in ${Date.now() - startedAt}ms`);
}

function readPngDimensions(buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Tray icon must be a valid PNG file.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function createIcoFromPngBuffer(buffer) {
  const { width, height } = readPngDimensions(buffer);
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);
  iconDir.writeUInt16LE(1, 2);
  iconDir.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(buffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([iconDir, entry, buffer]);
}

function ensureTrayIconPath(appRoot) {
  const pngPath = path.join(appRoot, "images", "topup.png");
  if (!fs.existsSync(pngPath)) {
    throw new Error(`Tray icon not found: ${pngPath}`);
  }

  if (process.platform !== "win32") {
    return pngPath;
  }

  const icoPath = path.join(appRoot, ".xlabrouter-tray.ico");
  const pngStats = fs.statSync(pngPath);
  const shouldRegenerate = !fs.existsSync(icoPath)
    || fs.statSync(icoPath).mtimeMs < pngStats.mtimeMs;

  if (shouldRegenerate) {
    const pngBuffer = fs.readFileSync(pngPath);
    fs.writeFileSync(icoPath, createIcoFromPngBuffer(pngBuffer));
  }

  return icoPath;
}

function getTrayIconBase64(appRoot) {
  const iconPath = ensureTrayIconPath(appRoot);
  return fs.readFileSync(iconPath).toString("base64");
}

function getDashboardUrl() {
  return `http://localhost:${port}`;
}

function getLogFilePath() {
  return path.join(getRuntimeDataDir(), LOG_FILE_NAME);
}

function isWindows() {
  return process.platform === "win32";
}

function getWindowsStartupDir() {
  const appDataDir = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appDataDir, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

function getAutostartScriptPath() {
  return path.join(getWindowsStartupDir(), "XLab Router Autostart.vbs");
}

function getTrayHostScriptPath() {
  return path.resolve(__filename);
}

function getAutostartScriptContent() {
  const hiddenNode = getHiddenNodeExecutable().replace(/"/g, '""');
  const trayHostScript = getTrayHostScriptPath().replace(/"/g, '""');
  return [
    'Set WshShell = CreateObject("WScript.Shell")',
    `WshShell.Run Chr(34) & "${hiddenNode}" & Chr(34) & " " & Chr(34) & "${trayHostScript}" & Chr(34) & " --tray-host", 0, False`,
  ].join("\r\n");
}

function isAutostartEnabled() {
  if (!isWindows()) {
    return false;
  }
  return fs.existsSync(getAutostartScriptPath());
}

function ensureAutostartEnabled() {
  if (!isWindows()) {
    throw new Error("Autostart hiá»‡n chá»‰ há»— trá»£ trÃªn Windows.");
  }

  const startupDir = getWindowsStartupDir();
  const autostartScriptPath = getAutostartScriptPath();
  fs.mkdirSync(startupDir, { recursive: true });
  fs.writeFileSync(autostartScriptPath, getAutostartScriptContent(), "utf8");
  return autostartScriptPath;
}

function disableAutostart() {
  if (!isWindows()) {
    throw new Error("Autostart hiá»‡n chá»‰ há»— trá»£ trÃªn Windows.");
  }

  const autostartScriptPath = getAutostartScriptPath();
  if (fs.existsSync(autostartScriptPath)) {
    fs.unlinkSync(autostartScriptPath);
  }
  return autostartScriptPath;
}

function printAutostartStatus() {
  if (!isWindows()) {
    console.log("[INFO] Autostart hiá»‡n chá»‰ há»— trá»£ trÃªn Windows.");
    return;
  }

  const autostartScriptPath = getAutostartScriptPath();
  if (isAutostartEnabled()) {
    console.log(`[OK] Autostart Ä‘ang báº­t: ${autostartScriptPath}`);
    return;
  }

  console.log(`[INFO] Autostart Ä‘ang táº¯t: ${autostartScriptPath}`);
}

async function launchWebUIProcess(options = {}) {
  const {
    exitOnChildExit = true,
    onReady,
    onExit,
    suppressCtrlCMessage = false,
  } = options;

  const nextBin = require.resolve("next/dist/bin/next");
  const repoRoot = path.resolve(__dirname, "..");
  const runtime = ensureWorkspaceRoot(repoRoot);
  const appRoot = runtime.appRoot;
  const sourceNodeModules = runtime.sourceNodeModules;
  const installedFromNpm = repoRoot.replace(/\\/g, "/").toLowerCase().includes("/node_modules/xlabrouter");

  const requestedMode = (process.env.XLABROUTER_WEB_MODE || "auto").toLowerCase();
  const isNonInteractive = !process.stdout.isTTY;
  const isNpmStart = process.env.npm_lifecycle_event === "start";
  let runProd = requestedMode === "production"
    || requestedMode === "prod"
    || (requestedMode === "auto" && (isNonInteractive || isNpmStart));
  let modeLabel = runProd ? "production" : "development";

  console.log(`\n[INFO] Starting XLab Router Web UI on ${hostname}:${port} (${modeLabel})...`);
  console.log(`[INFO] Runtime paths => repoRoot: ${repoRoot} | appRoot: ${appRoot}`);

  runAutoCleanup(appRoot);
  const killedPids = await stopOldXLabRouterProcesses(port, repoRoot);
  if (killedPids.length > 0) {
    console.log(`[INFO] Stopped old process(es) on port ${port}: ${killedPids.join(", ")}`);
  }

  console.log(`[INFO] Visit ${getDashboardUrl()}`);
  console.log(`[INFO] Logging to ${getLogFilePath()} (auto-delete at 100MB)`);
  if (!suppressCtrlCMessage) {
    console.log("[INFO] Press Ctrl+C to stop\n");
  } else {
    console.log("");
  }

  const ramMB = readRamConfig();
  const sharedEnv = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: hostname,
    NODE_PATH: sourceNodeModules,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--max-old-space-size=${ramMB}`, `--max-semi-space-size=64`, "--expose-gc"].filter(Boolean).join(" "),
    XLABROUTER_HIDE_NEXT_DEV_INDICATOR: installedFromNpm ? "1" : (process.env.XLABROUTER_HIDE_NEXT_DEV_INDICATOR || "0"),
    CLOUDFLARED_PROCESS_MODE: process.platform === "win32" ? (process.env.CLOUDFLARED_PROCESS_MODE || "true") : process.env.CLOUDFLARED_PROCESS_MODE,
    CLOUDFLARED_WINDOWS_SERVICE_MODE: process.platform === "win32" ? (process.env.CLOUDFLARED_WINDOWS_SERVICE_MODE || "false") : process.env.CLOUDFLARED_WINDOWS_SERVICE_MODE,
  };

  let prodLauncher = "standalone";
  if (runProd) {
    const buildIdPath = path.join(appRoot, ".next", "BUILD_ID");
    const standaloneServerPath = path.join(appRoot, ".next", "standalone", "server.js");
    let hasBuildId = fs.existsSync(buildIdPath);
    let hasStandalone = fs.existsSync(standaloneServerPath);

    if (!hasBuildId && !hasStandalone) {
      console.log("[INFO] Production build artifacts missing or incomplete. Running one-time build...");
      try {
        const build = spawn(process.execPath, [nextBin, "build", "--webpack"], {
          cwd: appRoot,
          stdio: "inherit",
          env: sharedEnv,
          windowsHide: true,
        });

        await new Promise((resolve, reject) => {
          build.on("error", reject);
          build.on("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Build failed with exit code ${code || 1}`));
          });
        });
      } catch (error) {
        console.log(`[WARN] Production build failed: ${error.message}`);
      }

      hasBuildId = fs.existsSync(buildIdPath);
      hasStandalone = fs.existsSync(standaloneServerPath);
    }

    if (!hasBuildId && !hasStandalone) {
      runProd = false;
      modeLabel = "development";
      console.log("[WARN] Production build is unavailable. Falling back to development mode.");
    } else if (!hasStandalone) {
      prodLauncher = "next-start";
      console.log("[WARN] Standalone artifacts are missing. Running production via next start.");
    }

    if (runProd && prodLauncher === "standalone") {
      copyDirectoryIfExists(
        path.join(appRoot, ".next", "static"),
        path.join(appRoot, ".next", "standalone", ".next", "static")
      );
      copyDirectoryIfExists(
        path.join(appRoot, "public"),
        path.join(appRoot, ".next", "standalone", "public")
      );
    }
  }

  const runtimeNode = process.env.XLABROUTER_BACKGROUND === "1" ? getHiddenNodeExecutable() : process.execPath;
  let commandPath;
  let commandArgs;
  if (runProd && prodLauncher === "standalone") {
    commandPath = runtimeNode;
    commandArgs = [path.join(appRoot, ".next", "standalone", "server.js")];
  } else if (runProd) {
    commandPath = runtimeNode;
    commandArgs = [nextBin, "start", "--hostname", hostname, "--port", String(port)];
  } else {
    commandPath = runtimeNode;
    commandArgs = [nextBin, "dev", "--webpack", "--hostname", hostname, "--port", String(port)];
  }

  const child = spawn(commandPath, commandArgs, {
    cwd: appRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: sharedEnv,
    windowsHide: true,
  });
  global.serverChild = child;
  child.on("exit", () => {
    if (global.serverChild === child) {
      global.serverChild = null;
    }
  });

  let warmupTriggered = false;
  let readyTriggered = false;
  let fallbackTriggered = false;
  const standaloneFailurePatterns = [
    "client reference manifest for route",
    "Failed to load static file for page: /500",
    "Cannot find module './chunks/",
  ];

  const triggerDevFallback = (reason) => {
    if (!runProd || fallbackTriggered) return;
    fallbackTriggered = true;
    console.log(`[WARN] Production standalone runtime is incomplete (${reason}). Falling back to development mode.`);
    try {
      child.removeAllListeners("exit");
      child.kill();
    } catch {}

    launchWebUIProcess({
      ...options,
      suppressCtrlCMessage,
    });
  };

  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);

      const text = chunk.toString();
      if (runProd && prodLauncher === "standalone" && standaloneFailurePatterns.some((pattern) => text.includes(pattern))) {
        triggerDevFallback(text.trim().split(/\r?\n/).slice(-1)[0]);
        return;
      }
      if (!warmupTriggered && /ready in/i.test(text)) {
        warmupTriggered = true;
        readyTriggered = true;
        const baseUrl = getDashboardUrl();
        warmupRoutes(baseUrl).catch((error) => {
          console.log(`[WARN] Warmup failed: ${error.message}`);
        });
        onReady?.({ child, repoRoot, appRoot, baseUrl });
      }
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      const text = chunk.toString();
      if (runProd && prodLauncher === "standalone" && standaloneFailurePatterns.some((pattern) => text.includes(pattern))) {
        triggerDevFallback(text.trim().split(/\r?\n/).slice(-1)[0]);
      }
    });
  }

  child.on("error", (err) => {
    console.error("[ERROR] Failed to start XLab Router:", err);
    onExit?.(1);
    if (exitOnChildExit) {
      process.exit(1);
    }
  });

  child.on("exit", (code) => {
    if (fallbackTriggered) {
      return;
    }
    if (!readyTriggered) {
      onReady?.({ child, repoRoot, appRoot, baseUrl: getDashboardUrl() });
      readyTriggered = true;
    }
    onExit?.(code || 0);
    if (exitOnChildExit) {
      process.exit(code || 0);
    }
  });

  return { child, repoRoot, appRoot, baseUrl: getDashboardUrl() };
}

async function startWebUI() {
  if (process.platform === "win32" && process.env.XLABROUTER_BACKGROUND !== "1") {
    launchDetachedWebHost();
    printWebLaunchMessage();
    setTimeout(() => {
      openPathOrUrl(getDashboardUrl()).catch((error) => {
        console.log(`[WARN] Could not open browser automatically: ${error.message}`);
      });
    }, 1200);
    return;
  }
  await launchWebUIProcess({
    onReady: ({ baseUrl }) => {
      openPathOrUrl(baseUrl).catch((error) => {
        console.log(`[WARN] Could not open browser automatically: ${error.message}`);
      });
    },
  });
}

function printTrayLaunchMessage() {
  console.log(`[INFO] XLab Router is starting in the system tray.`);
  console.log(`[INFO] Dashboard: ${getDashboardUrl()}`);
  console.log(`[INFO] Use the tray menu to open the dashboard, open logs, or quit.`);
  console.log(`[INFO] Run xlabrouter --web if you want to keep it in the current terminal.`);
  if (isWindows()) {
    console.log(`[INFO] Run xlabrouter --autostart-on to launch XLab Router automatically when Windows starts.`);
  }
}


function getHiddenNodeExecutable() {
  const nodeDir = path.dirname(process.execPath);
  const hiddenNodePath = process.platform === "win32"
    ? path.join(nodeDir, "nodew.exe")
    : process.execPath;
  return process.platform === "win32" && fs.existsSync(hiddenNodePath)
    ? hiddenNodePath
    : process.execPath;
}

function printWebLaunchMessage() {
  console.log(`[INFO] XLab Router is starting in background mode.`);
  console.log(`[INFO] Dashboard: ${getDashboardUrl()}`);
  console.log(`[INFO] No extra CMD windows will be shown.`);
}

function launchDetachedWebHost() {
  const child = spawn(getHiddenNodeExecutable(), [__filename, "--web-host"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      XLABROUTER_BACKGROUND: "1",
      XLABROUTER_LAUNCHED_FROM_ALIAS: "1",
    },
  });
  child.unref();
}

function launchDetachedTrayHost() {
  const child = spawn(getHiddenNodeExecutable(), [__filename, "--tray-host"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      XLABROUTER_LAUNCHED_FROM_ALIAS: "1",
    },
  });
  child.unref();
}

async function openPathOrUrl(target) {
  const openImport = require("open");
  const candidates = [
    openImport,
    openImport?.default,
    openImport?.open,
    openImport?.default?.open,
  ];
  const openTarget = candidates.find((candidate) => typeof candidate === "function");

  if (openTarget) {
    await openTarget(target, { wait: false });
    return;
  }

  const platform = process.platform;
  if (platform === "win32") {
    exec(`start "" "${target.replace(/"/g, '""')}"`, { windowsHide: true });
    return;
  }
  if (platform === "darwin") {
    exec(`open "${target.replace(/"/g, '\\"')}"`, { windowsHide: true });
    return;
  }
  exec(`xdg-open "${target.replace(/"/g, '\\"')}"`, { windowsHide: true });
}

async function startTrayHost() {
  const SysTrayImport = require("systray2");
  const SysTray = SysTrayImport.default || SysTrayImport;

  let shuttingDown = false;
  let tray;
  let serverChild;

  const cleanup = (exitCode = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    if (tray) {
      try {
        tray.kill(false);
      } catch (_) {
      }
    }

    if (serverChild && !serverChild.killed) {
      try {
        serverChild.kill("SIGTERM");
      } catch (_) {
      }
    }

    setTimeout(() => process.exit(exitCode), 250);
  };

  const launch = await launchWebUIProcess({
    exitOnChildExit: false,
    suppressCtrlCMessage: true,
    onExit: (code) => {
      if (!shuttingDown) {
        console.log(`[INFO] Web UI exited with code ${code}. Closing tray host.`);
        cleanup(code);
      }
    },
  });
  serverChild = launch.child;

  const icon = getTrayIconBase64(launch.appRoot);
  const autostartEnabled = isWindows() && isAutostartEnabled();
  tray = new SysTray({
    menu: {
      icon,
      title: "XLab Router",
      tooltip: `XLab Router ${pkg.version}`,
      items: [
        {
          title: `Dashboard: ${launch.baseUrl}`,
          tooltip: "Open XLab Router dashboard",
          checked: false,
          enabled: true,
        },
        {
          title: `Open Logs: ${path.basename(getLogFilePath())}`,
          tooltip: "Open log file",
          checked: false,
          enabled: true,
        },
        {
          title: autostartEnabled ? "Autostart: ON" : "Autostart: OFF",
          tooltip: isWindows() ? "Báº­t / táº¯t cháº¡y cÃ¹ng Windows" : "Autostart chá»‰ há»— trá»£ trÃªn Windows",
          checked: false,
          enabled: false,
        },
        {
          title: "Enable Autostart",
          tooltip: "Launch XLab Router automatically when you sign in",
          checked: false,
          enabled: isWindows() && !autostartEnabled,
        },
        {
          title: "Disable Autostart",
          tooltip: "Stop launching XLab Router automatically on sign in",
          checked: false,
          enabled: isWindows() && autostartEnabled,
        },
        {
          title: "Quit XLab Router",
          tooltip: "Stop XLab Router and close the tray",
          checked: false,
          enabled: true,
        },
      ],
    },
    copyDir: true,
    debug: false,
  });

  try {
    await tray.ready();
    console.log(`[INFO] System tray ready for ${launch.baseUrl}`);
  } catch (error) {
    console.error(`[ERROR] Tray failed: ${error.message}`);
    cleanup(1);
    return;
  }

  tray.onExit(() => {
    cleanup(0);
  });

  tray.onClick(async (event) => {
    try {
      if (event.seq_id === 0) {
        await openPathOrUrl(launch.baseUrl);
        return;
      }
      if (event.seq_id === 1) {
        await openPathOrUrl(getLogFilePath());
        return;
      }
      if (event.seq_id === 2) {
        return;
      }
      if (event.seq_id === 3) {
        const scriptPath = ensureAutostartEnabled();
        console.log(`[OK] Enabled autostart: ${scriptPath}`);
        await openPathOrUrl(getWindowsStartupDir());
        return;
      }
      if (event.seq_id === 4) {
        const scriptPath = disableAutostart();
        console.log(`[OK] Disabled autostart: ${scriptPath}`);
        return;
      }
      if (event.seq_id === 5) {
        cleanup(0);
      }
    } catch (error) {
      console.error(`[WARN] Tray action failed: ${error.message}`);
    }
  });


  process.on("SIGINT", () => cleanup(130));
  process.on("SIGTERM", () => cleanup(143));
}

function startTrayMode() {
  printTrayLaunchMessage();
  launchDetachedTrayHost();
  setTimeout(() => {
    openPathOrUrl(getDashboardUrl()).catch((error) => {
      console.log(`[WARN] Could not open browser automatically: ${error.message}`);
    });
  }, 1500);
}

function compareVersions(versionA, versionB) {
  const a = String(versionA || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = String(versionB || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(a.length, b.length);

  for (let i = 0; i < maxLength; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) {
      return 1;
    }
    if (av < bv) {
      return -1;
    }
  }

  return 0;
}

function runGlobalUpdate() {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const npmCommand = "npm";
    const npmArgs = ["i", "-g", pkg.name];
    let finished = false;

    const finish = (ok, message) => {
      if (finished) {
        return;
      }
      finished = true;
      if (!ok && message) {
        console.log(message);
      }
      resolve(ok);
    };

    const pipeOutput = (stream, writer) => {
      if (!stream || typeof stream.on !== "function" || typeof writer !== "function") {
        return;
      }
      stream.on("data", (chunk) => writer(chunk.toString()));
    };

    const attachExitHandlers = (childProcess) => {
      pipeOutput(childProcess.stdout, (text) => process.stdout?.write?.(text));
      pipeOutput(childProcess.stderr, (text) => process.stderr?.write?.(text));

      childProcess.on("exit", (code) => {
        if (code === 0) {
          finish(true);
          return;
        }
        finish(false, `[ERROR] Auto update failed (exit code ${code}).`);
      });
    };

    let primary;
    try {
      primary = spawn(npmCommand, npmArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: isWin,
        windowsHide: true,
      });
    } catch (error) {
      finish(false, `[ERROR] Auto update failed to start: ${error.message}`);
      return;
    }

    primary.on("error", (error) => {
      finish(false, `[ERROR] Auto update failed to start: ${error.message}`);
    });

    attachExitHandlers(primary);
  });
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
            if (compareVersions(latestVersion, pkg.version) > 0) {
              resolve({ hasUpdate: true, latestVersion });
              return;
            } else {
              console.log(`[OK] You are using the latest version.`);
            }
          } else {
            console.log(`[WARN] Could not determine latest version.`);
          }
        } catch (e) {
          console.log(`[WARN] Failed to parse version info.`);
        }
        resolve({ hasUpdate: false, latestVersion: null });
      });
    });

    req.on("error", () => {
      console.log(`[WARN] Could not check for updates (network error).`);
      resolve({ hasUpdate: false, latestVersion: null });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`[WARN] Update check timed out.`);
      resolve({ hasUpdate: false, latestVersion: null });
    });

    req.end();
  });
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
        { name: "Hide to Tray (System Tray)", value: "tray" },
        ...(isWindows() ? [{ name: `Autostart: ${isAutostartEnabled() ? "ON" : "OFF"}`, value: "autostart" }] : []),
        new inquirer.Separator(),
        { name: "Check for Updates", value: "update" },
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
    case "autostart":
      {
        const enabled = isAutostartEnabled();
        const answer = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmToggle",
            message: enabled
              ? "Autostart Ä‘ang báº­t. Báº¡n muá»‘n táº¯t khÃ´ng?"
              : "Báº­t autostart Ä‘á»ƒ XLab Router tá»± cháº¡y cÃ¹ng Windows?",
            default: true,
          },
        ]);

        if (enabled) {
          if (answer.confirmToggle) {
            disableAutostart();
            console.log("[OK] ÄÃ£ táº¯t autostart cho XLab Router.");
          } else {
            console.log("[INFO] Giá»¯ nguyÃªn autostart Ä‘ang báº­t.");
          }
        } else if (answer.confirmToggle) {
          const scriptPath = ensureAutostartEnabled();
          console.log(`[OK] ÄÃ£ báº­t autostart: ${scriptPath}`);
        } else {
          console.log("[INFO] ChÆ°a báº­t autostart.");
        }
      }
      console.log("");
      await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      await showMenu();
      break;
    case "update":
      {
        const updateInfo = await checkForUpdates();
        if (updateInfo?.hasUpdate) {
          console.log(`[WARN] New version available: ${updateInfo.latestVersion}`);
          const answer = await inquirer.prompt([
            {
              type: "confirm",
              name: "autoUpdate",
              message: `Update now to v${updateInfo.latestVersion}?`,
              default: true,
            },
          ]);

          if (answer.autoUpdate) {
            console.log(`[INFO] Running auto update: npm i -g ${pkg.name}`);
            const success = await runGlobalUpdate();
            if (success) {
              console.log(`[OK] Update completed. Please restart XLab Router.`);
            }
          } else {
            console.log(`[INFO] Skipped auto update.`);
          }
        }
      }
      console.log("");
      await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      await showMenu();
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
  startWebUI().catch((err) => {
    console.error("[ERROR] Web UI failed:", err);
    process.exit(1);
  });
} else if (command === "--web-host") {
  launchWebUIProcess().catch((err) => {
    console.error("[ERROR] Web host failed:", err);
    process.exit(1);
  });
} else if (command === "--tray-host") {
  startTrayHost().catch((err) => {
    console.error("[ERROR] Tray host failed:", err);
    process.exit(1);
  });
} else if (command === "--tray") {
  startTrayMode();
} else if (command === "--autostart-on") {
  try {
    const scriptPath = ensureAutostartEnabled();
    console.log(`[OK] Enabled autostart: ${scriptPath}`);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }
} else if (command === "--autostart-off") {
  try {
    const scriptPath = disableAutostart();
    console.log(`[OK] Disabled autostart: ${scriptPath}`);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }
} else if (command === "--autostart-status") {
  printAutostartStatus();
} else if (!command || command === "--menu") {
  showMenu().catch((err) => {
    console.error("[ERROR] Menu failed:", err);
    process.exit(1);
  });
} else {
  console.error(`[ERROR] Unknown command: ${command}`);
  console.error("[INFO] Run xlabrouter --help to see available options.");
  process.exit(1);
}
