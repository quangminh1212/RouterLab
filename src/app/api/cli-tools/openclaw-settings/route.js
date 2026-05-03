import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { headers, cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { getAuthSecret } from "@/lib/auth/sessionSecret";

const execAsync = promisify(exec);
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECRET = getAuthSecret();
const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";

async function hasValidCliToken() {
  const hdrs = await headers();
  const token = hdrs.get(CLI_TOKEN_HEADER);
  if (!token) return false;
  return token === await getConsistentMachineId(CLI_TOKEN_SALT);
}

async function hasValidJwtCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

async function requireAuth() {
  if (await hasValidCliToken()) return null;
  if (await hasValidJwtCookie()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const getOpenClawDir = () => path.join(os.homedir(), ".openclaw");
const getOpenClawSettingsPath = () => path.join(getOpenClawDir(), "openclaw.json");
const getDefaultAgentModelsDir = () => path.join(getOpenClawDir(), "agents", "main", "agent");
const OPENCLAW_RECOMMENDED_MODEL = "kr/claude-sonnet-4.5";
const OPENCLAW_LOCAL_BASE_URL = "http://localhost:1212/v1";

const normalizeOpenClawModel = (model) => {
  const normalized = String(model || "").trim().replace(/^xlabrouter\//, "");
  return !normalized ? OPENCLAW_RECOMMENDED_MODEL : normalized;
};

const normalizeOpenClawBaseUrl = (baseUrl) => {
  const url = String(baseUrl || "").trim();
  if (!url) return OPENCLAW_LOCAL_BASE_URL;
  try {
    const parsed = new URL(url.endsWith("/v1") ? url : `${url}/v1`);
    if (parsed.hostname === "api.xlabrnd.com") return OPENCLAW_LOCAL_BASE_URL;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.endsWith("/v1") ? url : `${url}/v1`;
  }
};

const fileExists = async (targetPath) => {
  if (!targetPath) return false;
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const parseJsonFile = async (targetPath) => {
  const content = await fs.readFile(targetPath, "utf-8");
  return JSON.parse(String(content).replace(/^\uFEFF/, "").trim());
};

const findWindowsOpenClawInstallation = async () => {
  const candidateBins = [];
  const appData = process.env.APPDATA;
  const userProfile = process.env.USERPROFILE;
  const localAppData = process.env.LOCALAPPDATA;

  if (appData) candidateBins.push(path.join(appData, "npm"));
  if (userProfile) candidateBins.push(path.join(userProfile, "AppData", "Roaming", "npm"));
  if (localAppData) candidateBins.push(path.join(localAppData, "Programs", "npm"));

  try {
    const { stdout } = await execAsync("npm config get prefix", { windowsHide: true });
    const prefix = String(stdout || "").trim();
    if (prefix) candidateBins.push(prefix);
  } catch {}

  const uniqueBins = [...new Set(candidateBins.filter(Boolean))];
  const env = { ...process.env, PATH: [...uniqueBins, process.env.PATH || ""].join(";") };

  for (const command of ["where.exe openclaw", "where.exe openclaw.cmd", "where.exe openclaw.ps1"]) {
    try {
      const { stdout } = await execAsync(command, { windowsHide: true, env });
      const detectedPath = String(stdout || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (detectedPath) {
        return { installed: true, method: command, cliPath: detectedPath, checkedBins: uniqueBins };
      }
    } catch {}
  }

  for (const binDir of uniqueBins) {
    for (const executable of ["openclaw.cmd", "openclaw.ps1", "openclaw"]) {
      const candidate = path.join(binDir, executable);
      if (await fileExists(candidate)) {
        return { installed: true, method: `file:${executable}`, cliPath: candidate, checkedBins: uniqueBins };
      }
    }
  }

  const usersRoot = `${process.env.SystemDrive || "C:"}${path.sep}Users`;
  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const dirent of userDirs) {
      if (!dirent.isDirectory()) continue;
      for (const executable of ["openclaw.cmd", "openclaw.ps1", "openclaw"]) {
        const candidate = path.join(usersRoot, dirent.name, "AppData", "Roaming", "npm", executable);
        if (await fileExists(candidate)) {
          return { installed: true, method: `scan:${executable}`, cliPath: candidate, checkedBins: uniqueBins };
        }
      }
    }
  } catch {}

  return { installed: false, method: null, cliPath: null, checkedBins: uniqueBins };
};

// Check if openclaw CLI is installed (via which/where or config file exists)
const checkOpenClawInstalled = async () => {
  const detection = {
    installed: false,
    method: null,
    cliPath: null,
    settingsPath: null,
    checkedBins: [],
  };

  try {
    const isWindows = os.platform() === "win32";
    if (isWindows) {
      const windowsDetection = await findWindowsOpenClawInstallation();
      Object.assign(detection, windowsDetection);
      if (windowsDetection.installed) return detection;
    } else {
      const { stdout } = await execAsync("which openclaw", { windowsHide: true, env: process.env });
      const cliPath = String(stdout || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
      if (cliPath) {
        return { ...detection, installed: true, method: "which openclaw", cliPath };
      }
    }
  } catch {
    // fall through to settings file check below
  }

  // Fallback: existing local config means OpenClaw was configured at least once
  if (await fileExists(getOpenClawSettingsPath())) {
    return {
      ...detection,
      installed: true,
      method: "settings-file",
      settingsPath: getOpenClawSettingsPath(),
    };
  }

  // Optional fallback for elevated process using another homedir
  const usersRoot = `${process.env.SystemDrive || "C:"}${path.sep}Users`;
  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const dirent of userDirs) {
      if (!dirent.isDirectory()) continue;
      const candidate = path.join(usersRoot, dirent.name, ".openclaw", "openclaw.json");
      if (await fileExists(candidate)) {
        return {
          ...detection,
          installed: true,
          method: "settings-scan",
          settingsPath: candidate,
        };
      }
    }
  } catch {}

  return detection;
};

// Read current settings.json
const readSettings = async () => {
  try {
    const settingsPath = getOpenClawSettingsPath();
    return await parseJsonFile(settingsPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

// Check if settings has xlabrouter config
const hasxlabrouterConfig = (settings) => {
  if (!settings || !settings.models || !settings.models.providers) return false;
  return !!settings.models.providers["xlabrouter"];
};

// Read per-agent models.json and return current model id (without "xlabrouter/" prefix)
const readAgentModel = async (agentDir) => {
  try {
    const modelsPath = path.join(agentDir, "models.json");
    const content = await fs.readFile(modelsPath, "utf-8");
    const data = JSON.parse(content);
    const models = data?.providers?.["xlabrouter"]?.models;
    return models?.[0]?.id || null;
  } catch {
    return null;
  }
};

// GET - Check openclaw CLI and read current settings
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  try {
    const detection = await checkOpenClawInstalled();
    
    if (!detection.installed) {
      return NextResponse.json({
        installed: false,
        settings: null,
        message: "Open Claw CLI is not installed",
        detection,
      });
    }

    const settings = await readSettings();

    // Enrich agents list with current per-agent model from models.json
    const agentList = settings?.agents?.list || [];
    const enrichedAgents = await Promise.all(
      agentList.map(async (agent) => {
        const agentModel = agent.agentDir ? await readAgentModel(agent.agentDir) : null;
        return { ...agent, currentModel: agentModel };
      })
    );

    return NextResponse.json({
      installed: true,
      settings,
      agents: enrichedAgents,
      hasxlabrouter: hasxlabrouterConfig(settings),
      settingsPath: getOpenClawSettingsPath(),
      detection,
    });
  } catch (error) {
    console.log("Error checking openclaw settings:", error);
    return NextResponse.json({ error: "Failed to check openclaw settings" }, { status: 500 });
  }
}

// Write per-agent models.json
const writeAgentModels = async (agentDir, models, baseUrl, apiKey) => {
  await fs.mkdir(agentDir, { recursive: true });
  const modelsPath = path.join(agentDir, "models.json");
  let existing = {};
  try {
    const content = await fs.readFile(modelsPath, "utf-8");
    existing = JSON.parse(content);
  } catch { /* No existing */ }

  if (!existing.providers) existing.providers = {};
  const modelIds = [...new Set(models.map((item) => normalizeOpenClawModel(item)).filter(Boolean))];
  existing.providers["xlabrouter"] = {
    baseUrl,
    apiKey: apiKey || "your_api_key",
    api: "openai-completions",
    models: modelIds.map((id) => ({ id, name: id.split("/").pop() || id })),
  };
  await fs.writeFile(modelsPath, JSON.stringify(existing, null, 2));
};

const normalizeRestoredOpenClawSettings = (settings) => {
  const next = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  if (!next.agents) next.agents = {};
  if (!next.agents.defaults) next.agents.defaults = {};
  if (!next.agents.defaults.model) next.agents.defaults.model = {};
  if (!next.agents.defaults.models) next.agents.defaults.models = {};
  if (!next.models) next.models = {};
  if (!next.models.providers) next.models.providers = {};

  const model = OPENCLAW_RECOMMENDED_MODEL;
  next.agents.defaults.model.primary = `xlabrouter/${model}`;
  next.agents.defaults.models = { [`xlabrouter/${model}`]: {} };
  next.models.providers.xlabrouter = {
    baseUrl: OPENCLAW_LOCAL_BASE_URL,
    apiKey: next.models.providers.xlabrouter?.apiKey || "your_api_key",
    api: "openai-completions",
    models: [{ id: model, name: model.split("/").pop() || model }],
  };
  return next;
};

const getConfiguredAgentModelDirs = (settings) => {
  const dirs = new Set();
  const agentList = Array.isArray(settings?.agents?.list) ? settings.agents.list : [];
  for (const agent of agentList) {
    if (agent?.agentDir) dirs.add(agent.agentDir);
  }
  dirs.add(getDefaultAgentModelsDir());
  return [...dirs];
};

// POST - Update xlabrouter settings (merge with existing settings)
export async function POST(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  try {
    // agentModels: { [agentId]: modelId } for per-agent override
    const { baseUrl, apiKey, model, agentModels = {} } = await request.json();
    
    if (!baseUrl || !model) {
      return NextResponse.json({ error: "baseUrl and model are required" }, { status: 400 });
    }

    const openclawDir = getOpenClawDir();
    const settingsPath = getOpenClawSettingsPath();

    await fs.mkdir(openclawDir, { recursive: true });

    let settings = {};
    try {
      settings = await parseJsonFile(settingsPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    if (!settings.agents) settings.agents = {};
    if (!settings.agents.defaults) settings.agents.defaults = {};
    if (!settings.agents.defaults.model) settings.agents.defaults.model = {};
    if (!settings.agents.defaults.models) settings.agents.defaults.models = {};
    if (!settings.models) settings.models = {};
    if (!settings.models.providers) settings.models.providers = {};

    const normalizedBaseUrl = normalizeOpenClawBaseUrl(baseUrl);
    const normalizedModel = normalizeOpenClawModel(model);
    const normalizedAgentModels = Object.fromEntries(
      Object.entries(agentModels).map(([agentId, agentModel]) => [agentId, normalizeOpenClawModel(agentModel)])
    );
    const fullModelId = `xlabrouter/${normalizedModel}`;

    // Remove all old xlabrouter/* entries from agents.defaults.models
    Object.keys(settings.agents.defaults.models)
      .filter((k) => k.startsWith("xlabrouter/"))
      .forEach((k) => { delete settings.agents.defaults.models[k]; });

    // Update default model
    settings.agents.defaults.model.primary = fullModelId;

    // Collect all unique models (default + per-agent)
    const allModelIds = new Set([normalizedModel]);
    Object.values(normalizedAgentModels).forEach((m) => { if (m) allModelIds.add(m); });

    // Add fresh xlabrouter models to allowlist
    allModelIds.forEach((m) => {
      settings.agents.defaults.models[`xlabrouter/${m}`] = {};
    });

    // Remove old xlabrouter model from each agent in agents.list
    if (settings.agents.list) {
      settings.agents.list = settings.agents.list.map((agent) => {
        if (agent.model?.startsWith("xlabrouter/")) {
          const { model: _, ...rest } = agent;
          return rest;
        }
        return agent;
      });
    }

    // Update models.providers.xlabrouter with all models
    settings.models.providers["xlabrouter"] = {
      baseUrl: normalizedBaseUrl,
      apiKey: apiKey || "your_api_key",
      api: "openai-completions",
      models: [...allModelIds].map((m) => ({ id: m, name: m.split("/").pop() || m })),
    };

    // Set per-agent model in agents.list and write models.json
    if (settings.agents.list) {
      settings.agents.list = settings.agents.list.map((agent) => {
        const agentModel = normalizedAgentModels[agent.id];
        if (agentModel) return { ...agent, model: `xlabrouter/${agentModel}` };
        return agent;
      });

    }

    // OpenClaw also keeps a runtime model cache under agents/main/agent/models.json
    // even when agents.list is absent. Keep every known cache in sync.
    await Promise.all(
      getConfiguredAgentModelDirs(settings).map(async (agentDir) => {
        const agent = settings.agents?.list?.find((item) => item.agentDir === agentDir);
        const modelToWrite = (agent?.id && normalizedAgentModels[agent.id]) || normalizedModel;
        await writeAgentModels(agentDir, [...allModelIds, modelToWrite], normalizedBaseUrl, apiKey);
      })
    );

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    return NextResponse.json({
      success: true,
      message: "Open Claw settings applied successfully!",
      settingsPath,
    });
  } catch (error) {
    console.log("Error updating openclaw settings:", error);
    return NextResponse.json({ error: "Failed to update openclaw settings" }, { status: 500 });
  }
}

// DELETE - Remove xlabrouter settings only (keep other settings)
export async function DELETE() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  try {
    const settingsPath = getOpenClawSettingsPath();

    // Read existing settings
    let settings = {};
    try {
      settings = await parseJsonFile(settingsPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No settings file to reset",
        });
      }
      throw error;
    }

    // Remove xlabrouter from models.providers
    if (settings.models && settings.models.providers) {
      delete settings.models.providers["xlabrouter"];
      
      // Remove providers object if empty
      if (Object.keys(settings.models.providers).length === 0) {
        delete settings.models.providers;
      }
    }

    // Remove xlabrouter models from agents.defaults.models allowlist
    if (settings.agents?.defaults?.models) {
      const keysToRemove = Object.keys(settings.agents.defaults.models).filter((k) => k.startsWith("xlabrouter/"));
      for (const key of keysToRemove) {
        delete settings.agents.defaults.models[key];
      }
      if (Object.keys(settings.agents.defaults.models).length === 0) {
        delete settings.agents.defaults.models;
      }
    }

    // Reset agents.defaults.model.primary if it uses xlabrouter
    if (settings.agents?.defaults?.model?.primary?.startsWith("xlabrouter/")) {
      delete settings.agents.defaults.model.primary;
    }

    // Write updated settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    return NextResponse.json({
      success: true,
      message: "xlabrouter settings removed successfully",
    });
  } catch (error) {
    console.log("Error resetting openclaw settings:", error);
    return NextResponse.json({ error: "Failed to reset openclaw settings" }, { status: 500 });
  }
}

const readAgentModelsBackup = async (agentDir) => {
  try {
    const content = await fs.readFile(path.join(agentDir, "models.json"), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
};

export const getOpenClawSettingsBackup = async () => {
  const settings = await readSettings();
  const agentList = Array.isArray(settings?.agents?.list) ? settings.agents.list : [];
  const agentModels = {};

  await Promise.all(
    agentList.map(async (agent) => {
      if (!agent?.id || !agent?.agentDir) return;
      agentModels[agent.id] = {
        agentDir: agent.agentDir,
        models: await readAgentModelsBackup(agent.agentDir),
      };
    })
  );

  return {
    settingsPath: getOpenClawSettingsPath(),
    settings,
    agentModels,
  };
};

export const restoreOpenClawSettingsBackup = async (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  if (payload.settings !== null && typeof payload.settings !== "object") {
    throw new Error("Invalid OpenClaw settings backup");
  }

  await fs.mkdir(getOpenClawDir(), { recursive: true });
  const settings = normalizeRestoredOpenClawSettings(payload.settings || {});
  await fs.writeFile(getOpenClawSettingsPath(), JSON.stringify(settings, null, 2));

  if (payload.agentModels && typeof payload.agentModels === "object") {
    await Promise.all(
      Object.values(payload.agentModels).map(async (entry) => {
        if (!entry?.agentDir || !entry?.models || typeof entry.models !== "object") return;
        await fs.mkdir(entry.agentDir, { recursive: true });
        await writeAgentModels(entry.agentDir, [OPENCLAW_RECOMMENDED_MODEL], OPENCLAW_LOCAL_BASE_URL, settings.models.providers.xlabrouter.apiKey);
      })
    );
  }

  await writeAgentModels(getDefaultAgentModelsDir(), [OPENCLAW_RECOMMENDED_MODEL], OPENCLAW_LOCAL_BASE_URL, settings.models.providers.xlabrouter.apiKey);
};
