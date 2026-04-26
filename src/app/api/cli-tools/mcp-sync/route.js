import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { parseTOML, stringifyTOML } from "confbox";

const getCodexDir = () => path.join(os.homedir(), ".codex");
const getCodexConfigPath = () => path.join(getCodexDir(), "config.toml");
const getClaudeProjectMcpPath = () => path.join(process.cwd(), ".mcp.json");

function sanitizeServerId(raw, fallback) {
  const candidate = typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
  const normalized = candidate.replace(/[^a-zA-Z0-9_-]/g, "-");
  return normalized || fallback;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeMcpServers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const source = asObject(item);
      const id = sanitizeServerId(source.id || source.name, `server-${index + 1}`);
      const endpoint = typeof source.endpoint === "string" ? source.endpoint.trim() : "";
      const command = typeof source.command === "string" ? source.command.trim() : "";
      const args = toStringArray(source.args);
      const env = asObject(source.env);
      const headers = asObject(source.headers);
      const apiKey = typeof source.apiKey === "string" ? source.apiKey.trim() : "";
      const enabled = source.enabled !== false;
      const enabledTools = toStringArray(source.enabledTools);
      const disabledTools = toStringArray(source.disabledTools);
      const envVars = toStringArray(source.envVars);
      const cwd = typeof source.cwd === "string" ? source.cwd.trim() : "";
      const bearerTokenEnvVar = typeof source.bearerTokenEnvVar === "string" ? source.bearerTokenEnvVar.trim() : "";

      const startupTimeoutSec = Number.isFinite(Number(source.startupTimeoutSec))
        ? Number(source.startupTimeoutSec)
        : 20;
      const toolTimeoutSec = Number.isFinite(Number(source.toolTimeoutSec))
        ? Number(source.toolTimeoutSec)
        : 120;

      const supportsParallelToolCalls = source.supportsParallelToolCalls === true;
      const required = source.required === true;

      return {
        id,
        endpoint,
        command,
        args,
        env,
        headers,
        apiKey,
        enabled,
        enabledTools,
        disabledTools,
        envVars,
        cwd,
        bearerTokenEnvVar,
        startupTimeoutSec,
        toolTimeoutSec,
        supportsParallelToolCalls,
        required,
      };
    })
    .filter((item) => item.command || item.endpoint);
}

function toCodexMcpEntry(server) {
  const entry = {
    enabled: server.enabled,
    startup_timeout_sec: server.startupTimeoutSec,
    tool_timeout_sec: server.toolTimeoutSec,
  };

  if (server.supportsParallelToolCalls) entry.supports_parallel_tool_calls = true;
  if (server.required) entry.required = true;
  if (server.enabledTools.length > 0) entry.enabled_tools = server.enabledTools;
  if (server.disabledTools.length > 0) entry.disabled_tools = server.disabledTools;

  if (server.command) {
    entry.command = server.command;
    if (server.args.length > 0) entry.args = server.args;
    if (Object.keys(server.env).length > 0) entry.env = server.env;
    if (server.envVars.length > 0) entry.env_vars = server.envVars;
    if (server.cwd) entry.cwd = server.cwd;
    return entry;
  }

  entry.url = server.endpoint;
  if (server.bearerTokenEnvVar) entry.bearer_token_env_var = server.bearerTokenEnvVar;

  const mergedHeaders = { ...server.headers };
  if (server.apiKey && !mergedHeaders.Authorization && !server.bearerTokenEnvVar) {
    mergedHeaders.Authorization = `Bearer ${server.apiKey}`;
  }
  if (Object.keys(mergedHeaders).length > 0) {
    entry.http_headers = mergedHeaders;
  }
  return entry;
}

function toClaudeMcpEntry(server) {
  if (server.command) {
    const entry = {
      command: server.command,
    };
    if (server.args.length > 0) entry.args = server.args;
    if (Object.keys(server.env).length > 0) entry.env = server.env;
    return entry;
  }

  const mergedHeaders = { ...server.headers };
  if (server.apiKey && !mergedHeaders.Authorization) {
    mergedHeaders.Authorization = `Bearer ${server.apiKey}`;
  }

  const entry = {
    type: "http",
    url: server.endpoint,
  };
  if (Object.keys(mergedHeaders).length > 0) {
    entry.headers = mergedHeaders;
  }
  return entry;
}

async function syncCodexMcpServers(servers) {
  const codexDir = getCodexDir();
  const configPath = getCodexConfigPath();
  await fs.mkdir(codexDir, { recursive: true });

  let parsed = {};
  try {
    const existing = await fs.readFile(configPath, "utf-8");
    parsed = parseTOML(existing) || {};
  } catch {
    parsed = {};
  }

  const existingMcp = asObject(parsed.mcp_servers);
  const nextMcp = { ...existingMcp };
  for (const server of servers) {
    nextMcp[server.id] = toCodexMcpEntry(server);
  }

  parsed.mcp_servers = nextMcp;
  await fs.writeFile(configPath, stringifyTOML(parsed));
  return { path: configPath, synced: servers.length };
}

async function syncClaudeProjectMcpServers(servers) {
  const mcpPath = getClaudeProjectMcpPath();
  let current = {};
  try {
    const raw = await fs.readFile(mcpPath, "utf-8");
    current = JSON.parse(raw);
  } catch {
    current = {};
  }

  const next = {
    ...asObject(current),
    mcpServers: {
      ...asObject(current.mcpServers),
    },
  };

  for (const server of servers) {
    next.mcpServers[server.id] = toClaudeMcpEntry(server);
  }

  await fs.writeFile(mcpPath, JSON.stringify(next, null, 2));
  return { path: mcpPath, synced: servers.length };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const target = typeof body?.target === "string" ? body.target : "all";
    const servers = normalizeMcpServers(body?.mcpServers);

    if (servers.length === 0) {
      return NextResponse.json({ error: "No valid MCP servers to sync" }, { status: 400 });
    }

    const result = {};
    if (target === "all" || target === "codex") {
      result.codex = await syncCodexMcpServers(servers);
    }
    if (target === "all" || target === "claude") {
      result.claude = await syncClaudeProjectMcpServers(servers);
    }

    if (Object.keys(result).length === 0) {
      return NextResponse.json({ error: "Invalid sync target" }, { status: 400 });
    }

    return NextResponse.json({ success: true, target, result });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to sync MCP servers" }, { status: 500 });
  }
}

