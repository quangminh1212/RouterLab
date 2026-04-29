"use server";

import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function run(command) {
  return execSync(command, {
    stdio: "pipe",
    windowsHide: true,
    encoding: "utf8",
    timeout: 300000,
  });
}

function getManagedNgrokPath() {
  if (os.platform() === "win32") {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
    return path.join(home, ".xlabrouter", "bin", "ngrok.exe");
  }
  const home = process.env.HOME || os.homedir();
  return path.join(home, ".xlabrouter", "bin", "ngrok");
}

function ensureManagedDir() {
  const managedPath = getManagedNgrokPath();
  fs.mkdirSync(path.dirname(managedPath), { recursive: true });
  return managedPath;
}

function isNgrokInstalled() {
  try {
    const managedPath = getManagedNgrokPath();
    if (fs.existsSync(managedPath)) return true;

    if (os.platform() === "win32") run("where ngrok");
    else run("which ngrok");
    return true;
  } catch {
    return false;
  }
}

function installNgrokWindowsPortable() {
  const managedPath = ensureManagedDir();
  const managedDir = path.dirname(managedPath);
  const zipPath = path.join(managedDir, "ngrok.zip");

  const downloadCommand = `powershell -NoProfile -NonInteractive -Command \"$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile '${zipPath.replace(/\\/g, "\\\\")}'\"`;
  run(downloadCommand);

  const extractCommand = `powershell -NoProfile -NonInteractive -Command \"Expand-Archive -LiteralPath '${zipPath.replace(/\\/g, "\\\\")}' -DestinationPath '${managedDir.replace(/\\/g, "\\\\")}' -Force\"`;
  run(extractCommand);

  try {
    fs.unlinkSync(zipPath);
  } catch {
    // ignore cleanup failure
  }

  if (!fs.existsSync(managedPath)) {
    throw new Error("Portable ngrok install failed: ngrok.exe not found after extraction");
  }
}

function installNgrokMacPortable() {
  const managedPath = ensureManagedDir();
  const managedDir = path.dirname(managedPath);
  const zipPath = path.join(managedDir, "ngrok.zip");

  const arch = os.arch() === "arm64" ? "arm64" : "amd64";
  const downloadUrl = `https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-${arch}.zip`;

  run(`curl -fsSL -o "${zipPath}" "${downloadUrl}"`);
  run(`unzip -o "${zipPath}" -d "${managedDir}"`);
  run(`chmod +x "${managedPath}"`);

  try {
    fs.unlinkSync(zipPath);
  } catch {
    // ignore cleanup failure
  }

  if (!fs.existsSync(managedPath)) {
    throw new Error("Portable ngrok install failed: ngrok not found after extraction");
  }
}

function installNgrokLinuxPortable() {
  const managedPath = ensureManagedDir();
  const managedDir = path.dirname(managedPath);
  const tgzPath = path.join(managedDir, "ngrok.tgz");

  const arch = os.arch() === "arm64" ? "arm64" : (os.arch() === "arm" ? "arm" : "amd64");
  const downloadUrl = `https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${arch}.tgz`;

  run(`curl -fsSL -o "${tgzPath}" "${downloadUrl}"`);
  run(`tar -xzf "${tgzPath}" -C "${managedDir}"`);
  run(`chmod +x "${managedPath}"`);

  try {
    fs.unlinkSync(tgzPath);
  } catch {
    // ignore cleanup failure
  }

  if (!fs.existsSync(managedPath)) {
    throw new Error("Portable ngrok install failed: ngrok not found after extraction");
  }
}

export async function POST() {
  const platform = os.platform();

  try {
    if (isNgrokInstalled()) {
      return new Response(JSON.stringify({ success: true, message: "Ngrok is already installed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (platform === "win32") {
      try {
        installNgrokWindowsPortable();
      } catch {
        run("winget install --id ngrok.ngrok -e --accept-package-agreements --accept-source-agreements");
      }
    } else if (platform === "darwin") {
      try {
        installNgrokMacPortable();
      } catch {
        run("brew install ngrok/ngrok/ngrok");
      }
    } else {
      try {
        installNgrokLinuxPortable();
      } catch {
        run("sh -lc \"curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install -y ngrok\"");
      }
    }

    if (!isNgrokInstalled()) {
      throw new Error("Install command finished but ngrok not found in PATH");
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Ngrok installed successfully",
      managedPath: getManagedNgrokPath(),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || "Failed to install ngrok",
      platform,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
