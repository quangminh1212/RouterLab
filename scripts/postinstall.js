const os = require("os");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PLATFORM = os.platform();
const IS_WINDOWS = PLATFORM === "win32";
const IS_MAC = PLATFORM === "darwin";
const IS_LINUX = PLATFORM === "linux";
const WINDOWS_TAILSCALE_BIN = "C:\\\\Program Files\\\\Tailscale\\\\tailscale.exe";
const REQUIRE_TAILSCALE = process.env.XLABROUTER_REQUIRE_TAILSCALE !== "0";

function isTailscaleInstalled() {
  if (IS_WINDOWS && fs.existsSync(WINDOWS_TAILSCALE_BIN)) return true;
  try {
    execSync("which tailscale 2>/dev/null || where tailscale 2>nul", { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Download failed: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
      file.on("error", (err) => {
        file.close();
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on("error", (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function installTailscaleWindows() {
  console.log("[postinstall] Downloading Tailscale for Windows...");
  const tmpDir = os.tmpdir();
  const msiPath = path.join(tmpDir, "tailscale-setup.msi");
  
  try {
    await downloadFile("https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi", msiPath);
    console.log("[postinstall] Installing Tailscale (silent mode)...");
    console.log("[postinstall] This may require Administrator privileges...");
    execSync(`msiexec /i "${msiPath}" /quiet /norestart`, { stdio: "inherit", windowsHide: false, timeout: 180000 });
    
    // Wait a bit for installer to finish
    await new Promise(r => setTimeout(r, 3000));
    
    if (!isTailscaleInstalled()) {
      throw new Error("Installer finished but tailscale.exe was not found. Please run as Administrator.");
    }
    
    console.log("[postinstall] Tailscale installed successfully.");
    try { fs.unlinkSync(msiPath); } catch {}
  } catch (err) {
    throw new Error(`Tailscale install failed: ${err.message}`);
  }
}

function runShell(command, options = {}) {
  execSync(command, {
    stdio: "inherit",
    windowsHide: false,
    ...options
  });
}

function hasCommand(command) {
  try {
    execSync(`command -v ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function installTailscaleMac() {
  try {
    if (!hasCommand("brew")) {
      throw new Error("Homebrew not found. Please install Homebrew first.");
    }

    console.log("[postinstall] Installing Tailscale on macOS via Homebrew...");
    runShell("brew install tailscale", { timeout: 300000 });

    if (!isTailscaleInstalled()) {
      throw new Error("tailscale binary not found after brew install.");
    }

    console.log("[postinstall] Tailscale installed successfully on macOS.");
  } catch (err) {
    throw new Error(`Tailscale install failed on macOS: ${err.message}`);
  }
}

async function installTailscaleLinux() {
  try {
    console.log("[postinstall] Installing Tailscale on Linux...");

    if (hasCommand("sudo")) {
      runShell("curl -fsSL https://tailscale.com/install.sh | sudo sh", { timeout: 300000 });
    } else {
      runShell("curl -fsSL https://tailscale.com/install.sh | sh", { timeout: 300000 });
    }

    if (!isTailscaleInstalled()) {
      throw new Error("tailscale binary not found after install script.");
    }

    console.log("[postinstall] Tailscale installed successfully on Linux.");
  } catch (err) {
    throw new Error(`Tailscale install failed on Linux: ${err.message}`);
  }
}

(async () => {
  if (isTailscaleInstalled()) {
    console.log("[postinstall] Tailscale already installed.");
    return;
  }
  
  try {
    if (IS_WINDOWS) {
      await installTailscaleWindows();
    } else if (IS_MAC) {
      await installTailscaleMac();
    } else if (IS_LINUX) {
      await installTailscaleLinux();
    } else {
      throw new Error(`Unsupported platform: ${PLATFORM}`);
    }
  } catch (error) {
    const message = [
      "",
      "[postinstall] ============================================",
      "[postinstall] Tailscale installation failed!",
      `[postinstall] Error: ${error.message}`,
      "[postinstall] Platform-specific requirement:",
      IS_WINDOWS
        ? "[postinstall]   Run terminal as Administrator and re-run install"
        : "[postinstall]   Ensure your user has sudo/root privileges and re-run install",
      "[postinstall] ============================================",
      ""
    ].join("\n");

    if (REQUIRE_TAILSCALE) {
      console.error(message);
      process.exit(1);
    }

    console.warn(message);
  }
  
  if (REQUIRE_TAILSCALE && !isTailscaleInstalled()) {
    console.error("[postinstall] Tailscale is required but not installed.");
    process.exit(1);
  }
})();
