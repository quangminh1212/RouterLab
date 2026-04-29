"use server";

import os from "os";
import { execSync } from "child_process";

function run(command) {
  return execSync(command, {
    stdio: "pipe",
    windowsHide: true,
    encoding: "utf8",
    timeout: 300000,
  });
}

function isNgrokInstalled() {
  try {
    if (os.platform() === "win32") run("where ngrok");
    else run("which ngrok");
    return true;
  } catch {
    return false;
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
        run("winget install --id ngrok.ngrok -e --accept-package-agreements --accept-source-agreements");
      } catch {
        run("powershell -Command \"choco install ngrok -y\"");
      }
    } else if (platform === "darwin") {
      run("brew install ngrok/ngrok/ngrok");
    } else {
      run("sh -lc \"curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install -y ngrok\"");
    }

    if (!isNgrokInstalled()) {
      throw new Error("Install command finished but ngrok not found in PATH");
    }

    return new Response(JSON.stringify({ success: true, message: "Ngrok installed successfully" }), {
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

