#!/usr/bin/env node

const { spawn, exec } = require("child_process");
const path = require("path");
const pkg = require("../package.json");

const command = process.argv[2];
const port = process.env.PORT || 20128;

if (command === "--version" || command === "-v") {
  console.log(pkg.version);
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log("xlab_router - 9Router CLI");
  console.log("");
  console.log("Usage:");
  console.log("  xlab_router           Start dev server (default port 20128)");
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

const nextBin = require.resolve("next/dist/bin/next");

console.log(`Starting 9Router on port ${port}...`);

killProcessOnPort(port, () => {
  console.log(`Visit http://localhost:${port}`);

  const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "--port", String(port)], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });

  child.on("error", (err) => {
    console.error("Failed to start 9Router:", err);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
});