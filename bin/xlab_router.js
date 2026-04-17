#!/usr/bin/env node

const { spawn, exec } = require("child_process");
const path = require("path");
const pkg = require("../package.json");
const inquirer = require("inquirer").default || require("inquirer");
const https = require("https");

const command = process.argv[2];
const port = process.env.PORT || 20128;

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
  process.exit(0);
}

function killProcessOnPort(port, callback) {
  const isWin = process.platform === "win32";
  const cmd = isWin
    ? `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`
    : `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`;

  exec(cmd, (err) => {
    if (err && !isWin) {
      // Ignore errors on Unix (port might be free)
    }
    callback();
  });
}

function startWebUI() {
  const nextBin = require.resolve("next/dist/bin/next");

  console.log(`\n[INFO] Starting XLab Router Web UI on port ${port}...`);

  killProcessOnPort(port, () => {
    console.log(`[INFO] Visit http://localhost:${port}`);
    console.log(`[INFO] Press Ctrl+C to stop\n`);

    const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "--port", String(port)], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });

    child.on("error", (err) => {
      console.error("[ERROR] Failed to start XLab Router:", err);
      process.exit(1);
    });

    child.on("exit", (code) => {
      process.exit(code || 0);
    });
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