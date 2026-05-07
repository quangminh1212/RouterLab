#!/usr/bin/env node

/**
 * XLab Router Uninstall Script
 * Provides clean uninstallation with options to keep or remove user data
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const APP_NAME = "xlabrouter";
const DATA_DIR = path.join(os.homedir(), `.${APP_NAME}`);

// Check if --full flag is provided
const isFullUninstall = process.argv.includes("--full");

console.log(`\n🗑️  XLab Router Uninstall ${isFullUninstall ? "(FULL)" : "(Keep Data)"}\n`);

function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    console.log(`   Removing: ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`   ✓ Removed`);
  } else {
    console.log(`   ⊘ Not found: ${dir}`);
  }
}

function removeFile(file) {
  if (fs.existsSync(file)) {
    console.log(`   Removing: ${file}`);
    fs.unlinkSync(file);
    console.log(`   ✓ Removed`);
  }
}

try {
  console.log("📦 Uninstalling XLab Router package...\n");

  // Stop any running processes
  console.log("🛑 Stopping running processes...");
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /IM node.exe /FI "WINDOWTITLE eq xlabrouter*" 2>nul`, { stdio: "ignore" });
    } else {
      execSync(`pkill -f xlabrouter`, { stdio: "ignore" });
    }
    console.log("   ✓ Processes stopped\n");
  } catch (err) {
    console.log("   ⊘ No running processes found\n");
  }

  if (isFullUninstall) {
    console.log("⚠️  FULL UNINSTALL - Removing ALL data and configurations\n");
    console.log("📁 Removing user data directory...");
    removeDirectory(DATA_DIR);
    console.log("");

    // Remove additional config files
    console.log("🗂️  Removing configuration files...");
    const configFiles = [
      path.join(os.homedir(), ".xlabrouterrc"),
      path.join(os.homedir(), ".xlabrouter.json"),
    ];
    configFiles.forEach(removeFile);
    console.log("");
  } else {
    console.log("💾 Keeping user data and configurations in:");
    console.log(`   ${DATA_DIR}`);
    console.log("\n   To remove all data, run: npm run uninstall:full\n");
  }

  console.log("✅ XLab Router uninstalled successfully!\n");

  if (isFullUninstall) {
    console.log("⚠️  All data has been permanently deleted.\n");
  } else {
    console.log("💡 Your settings and database are preserved.");
    console.log("   Reinstalling will restore your configuration.\n");
  }

  console.log("Thank you for using XLab Router! 👋\n");
} catch (err) {
  console.error("\n❌ Error during uninstallation:", err.message);
  console.error("\nPlease try manual cleanup or contact support.\n");
  process.exit(1);
}
