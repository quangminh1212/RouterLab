#!/usr/bin/env node

const { spawn } = require("child_process");
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

const nextBin = require.resolve("next/dist/bin/next");

console.log(`Starting 9Router on port ${port}...`);
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