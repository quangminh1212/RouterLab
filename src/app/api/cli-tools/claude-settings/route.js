import { NextResponse } from "next/server";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const DEFAULT_CLAUDE_SETTINGS = {
  defaultMode: "acceptEdits",
  alwaysThinkingEnabled: true,
  effortLevel: "high",
};
const VALID_DEFAULT_MODES = new Set(["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"]);
const VALID_EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

const normalizeDefaultMode = (value) => {
  if (typeof value !== "string") return DEFAULT_CLAUDE_SETTINGS.defaultMode;
  const normalized = value.trim();
  return VALID_DEFAULT_MODES.has(normalized) ? normalized : DEFAULT_CLAUDE_SETTINGS.defaultMode;
};

const normalizeEffortLevel = (value) => {
  if (typeof value !== "string") return DEFAULT_CLAUDE_SETTINGS.effortLevel;
  const normalized = value.trim().toLowerCase();
  return VALID_EFFORT_LEVELS.has(normalized) ? normalized : DEFAULT_CLAUDE_SETTINGS.effortLevel;
};

const buildClaudeSettings = (currentSettings, env, options = {}) => ({
  ...currentSettings,
  hasCompletedOnboarding: true,
  defaultMode: normalizeDefaultMode(options.defaultMode || currentSettings.defaultMode),
  alwaysThinkingEnabled:
    typeof options.alwaysThinkingEnabled === "boolean"
      ? options.alwaysThinkingEnabled
      : typeof currentSettings.alwaysThinkingEnabled === "boolean"
        ? currentSettings.alwaysThinkingEnabled
        : DEFAULT_CLAUDE_SETTINGS.alwaysThinkingEnabled,
  effortLevel: normalizeEffortLevel(options.effortLevel || currentSettings.effortLevel),
  env: {
    ...(currentSettings.env || {}),
    ...env,
  },
});

// Get claude settings path based on OS
const getClaudeSettingsPath = () => {
  const homeDir = os.homedir();
  return path.join(homeDir, ".claude", "settings.json");
};

const getClaudeLegacySettingsPath = () => {
  const homeDir = os.homedir();
  return path.join(homeDir, ".claude.json");
};


// Check if claude CLI is installed (via which/where or config file exists)
const checkClaudeInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where claude" : "which claude";
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;
    await execAsync(command, { windowsHide: true, env });
    return true;
  } catch {
    try {
      await fs.access(getClaudeSettingsPath());
      return true;
    } catch {
      return false;
    }
  }
};

// Read current settings
export const readSettings = async () => {
  try {
    const settingsPath = getClaudeSettingsPath();
    const content = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const writeSettings = async (settings) => {
  const settingsPath = getClaudeSettingsPath();
  const claudeDir = path.dirname(settingsPath);
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
};

const readLegacySettings = async () => {
  try {
    const content = await fs.readFile(getClaudeLegacySettingsPath(), "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const writeLegacySettings = async (settings) => {
  await fs.writeFile(getClaudeLegacySettingsPath(), JSON.stringify(settings, null, 2));
};

const persistWindowsUserEnv = async (env) => {
  if (os.platform() !== "win32") return;

  const script = `
    [Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', $env:XLAB_CLAUDE_BASE_URL, 'User')
    [Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', $env:XLAB_CLAUDE_AUTH_TOKEN, 'User')
    [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')
    [Environment]::SetEnvironmentVariable('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', '1', 'User')
  `;

  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
    windowsHide: true,
    env: {
      ...process.env,
      XLAB_CLAUDE_BASE_URL: env.ANTHROPIC_BASE_URL || "",
      XLAB_CLAUDE_AUTH_TOKEN: env.ANTHROPIC_AUTH_TOKEN || "",
    },
  });
};

const clearWindowsUserEnv = async () => {
  if (os.platform() !== "win32") return;

  const script = `
    [Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', $null, 'User')
    [Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', $null, 'User')
    [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')
    [Environment]::SetEnvironmentVariable('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', $null, 'User')
  `;

  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], { windowsHide: true });
};

const buildLegacyClaudeSettings = (currentSettings, env, options = {}) => ({
  ...currentSettings,
  hasCompletedOnboarding: true,
  defaultMode: normalizeDefaultMode(options.defaultMode || currentSettings?.defaultMode),
  alwaysThinkingEnabled:
    typeof options.alwaysThinkingEnabled === "boolean"
      ? options.alwaysThinkingEnabled
      : typeof currentSettings?.alwaysThinkingEnabled === "boolean"
        ? currentSettings.alwaysThinkingEnabled
        : DEFAULT_CLAUDE_SETTINGS.alwaysThinkingEnabled,
  effortLevel: normalizeEffortLevel(options.effortLevel || currentSettings?.effortLevel),
  env: {
    ...(currentSettings?.env || {}),
    ...env,
  },
});

export const getClaudeSettingsBackup = async () => ({
  settingsPath: getClaudeSettingsPath(),
  settings: await readSettings(),
  legacySettingsPath: getClaudeLegacySettingsPath(),
  legacySettings: await readLegacySettings(),
});

export const restoreClaudeSettingsBackup = async (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  if (!("settings" in payload)) return;
  if (payload.settings !== null && typeof payload.settings !== "object") {
    throw new Error("Invalid Claude settings backup");
  }

  await writeSettings(payload.settings || {});

  if ("legacySettings" in payload) {
    if (payload.legacySettings !== null && typeof payload.legacySettings !== "object") {
      throw new Error("Invalid Claude legacy settings backup");
    }
    await writeLegacySettings(payload.legacySettings || {});
  }
};

export const clearClaudeSettings = async () => {
  await writeSettings({});
  await writeLegacySettings({});
};

export const buildClaudeSettingsPayload = (currentSettings, env, options = {}) =>
  buildClaudeSettings(currentSettings, env, options);

// GET - Check claude CLI and read current settings
export async function GET() {
  try {
    const isInstalled = await checkClaudeInstalled();
    
    if (!isInstalled) {
      return NextResponse.json({
        installed: false,
        settings: null,
        message: "Claude CLI is not installed",
      });
    }

    const settings = await readSettings();
    const legacySettings = await readLegacySettings();
    const hasxlabrouter = !!(settings?.env?.ANTHROPIC_BASE_URL);

    return NextResponse.json({
      installed: true,
      settings: settings,
      legacySettings,
      hasxlabrouter: hasxlabrouter,
      settingsPath: getClaudeSettingsPath(),
      legacySettingsPath: getClaudeLegacySettingsPath(),
    });
  } catch (error) {
    console.log("Error checking claude settings:", error);
    return NextResponse.json(
      { error: "Failed to check claude settings" },
      { status: 500 }
    );
  }
}

// POST - Backup old fields and write new settings
export async function POST(request) {
  try {
    const { env, defaultMode, effortLevel, alwaysThinkingEnabled } = await request.json();

    if (!env || typeof env !== "object") {
      return NextResponse.json(
        { error: "Invalid env object" },
        { status: 400 }
      );
    }

    const settingsPath = getClaudeSettingsPath();
    const claudeDir = path.dirname(settingsPath);

    // Ensure .claude directory exists
    await fs.mkdir(claudeDir, { recursive: true });

    // Read current settings
    let currentSettings = {};
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      currentSettings = JSON.parse(content);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    // Normalize ANTHROPIC_BASE_URL to ensure /v1 suffix
    if (env.ANTHROPIC_BASE_URL) {
      env.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL.endsWith("/v1")
        ? env.ANTHROPIC_BASE_URL
        : `${env.ANTHROPIC_BASE_URL}/v1`;
    }

    const newSettings = buildClaudeSettings(currentSettings, env, {
      defaultMode,
      effortLevel,
      alwaysThinkingEnabled,
    });
    const legacyCurrentSettings = (await readLegacySettings()) || {};
    const newLegacySettings = buildLegacyClaudeSettings(legacyCurrentSettings, env, {
      defaultMode,
      effortLevel,
      alwaysThinkingEnabled,
    });

    // Write new settings
    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));
    await writeLegacySettings(newLegacySettings);
    await persistWindowsUserEnv(env);

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.log("Error updating claude settings:", error);
    return NextResponse.json(
      { error: "Failed to update claude settings" },
      { status: 500 }
    );
  }
}

// Fields to remove when resetting
const RESET_ENV_KEYS = [
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "API_TIMEOUT_MS",
];

// DELETE - Reset settings (remove env fields)
export async function DELETE() {
  try {
    const settingsPath = getClaudeSettingsPath();
    const legacySettingsPath = getClaudeLegacySettingsPath();

    // Read current settings
    let currentSettings = {};
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      currentSettings = JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No settings file to reset",
        });
      }
      throw error;
    }

    // Remove specified env fields
    if (currentSettings.env) {
      RESET_ENV_KEYS.forEach((key) => {
        delete currentSettings.env[key];
      });
      
      // Clean up empty env object
      if (Object.keys(currentSettings.env).length === 0) {
        delete currentSettings.env;
      }
    }

    // Write updated settings
    await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));

    let legacySettings = {};
    try {
      const legacyContent = await fs.readFile(legacySettingsPath, "utf-8");
      legacySettings = JSON.parse(legacyContent);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    if (legacySettings.env) {
      RESET_ENV_KEYS.forEach((key) => {
        delete legacySettings.env[key];
      });

      if (Object.keys(legacySettings.env).length === 0) {
        delete legacySettings.env;
      }
    }

    await writeLegacySettings(legacySettings);
    await clearWindowsUserEnv();

    return NextResponse.json({
      success: true,
      message: "Settings reset successfully",
    });
  } catch (error) {
    console.log("Error resetting claude settings:", error);
    return NextResponse.json(
      { error: "Failed to reset claude settings" },
      { status: 500 }
    );
  }
}
