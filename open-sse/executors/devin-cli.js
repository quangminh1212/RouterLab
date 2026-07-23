import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { BaseExecutor } from "./base.js";
import {
  buildNonStreamingResponse,
  buildStreamingResponse,
  errorResponse,
  messagesToPrompt,
} from "./webChat/_base.js";

const DEFAULT_WIN =
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "devin", "cli", "bin", "devin.exe")
    : "";
const DEFAULT_UNIX = path.join(homedir(), ".local", "bin", "devin");

function resolveDevinBin(credentials) {
  const fromCred =
    credentials?.providerSpecificData?.devinPath ||
    credentials?.providerSpecificData?.command ||
    credentials?.apiKey; // allow pasting full path as "key" for noAuth UX
  const candidates = [
    process.env.DEVIN_CLI_PATH,
    process.env.HERMES_DEVIN_ACP_COMMAND,
    fromCred,
    DEFAULT_WIN,
    DEFAULT_UNIX,
    "devin",
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === "devin" || existsSync(c)) return c;
  }
  return candidates[0] || "devin";
}

function resolveCwd(credentials) {
  const psd = credentials?.providerSpecificData || {};
  const cwd =
    psd.cwd ||
    process.env.DEVIN_CLI_CWD ||
    process.env.HERMES_DEVIN_ACP_CWD ||
    path.join(process.env.LOCALAPPDATA || homedir(), "hermes", "acp-cwd");
  try {
    mkdirSync(cwd, { recursive: true });
  } catch {
    /* ignore */
  }
  return cwd;
}

function stripModelPrefix(model) {
  // Accept "devin-cli/swe-1-7", "dvcli/swe-1-7", raw "swe-1-7"
  const s = String(model || "").trim();
  const parts = s.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : s;
}

/**
 * DevinCLIExecutor — local Devin CLI via non-interactive print mode.
 * Spawns: devin -p --model <id> --permission-mode ask -- <prompt>
 */
export class DevinCLIExecutor extends BaseExecutor {
  constructor() {
    super("devin-cli", {
      baseUrl: "local://devin-cli",
      format: "openai",
      noAuth: true,
    });
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const modelId = stripModelPrefix(model) || "swe-1-7";
    const prompt = messagesToPrompt(body?.messages);
    if (!prompt.trim()) {
      return wrap(errorResponse("Missing or empty messages array", 400, "invalid_request"), body);
    }

    const bin = resolveDevinBin(credentials);
    const cwd = resolveCwd(credentials);
    const permission =
      credentials?.providerSpecificData?.permissionMode ||
      process.env.DEVIN_PERMISSION_MODE ||
      process.env.HERMES_DEVIN_ACP_MODE ||
      "ask";

    const args = [
      "-p",
      "--model",
      modelId,
      "--permission-mode",
      permission,
      "--",
      prompt,
    ];

    log?.info?.("DEVIN-CLI", `${bin} model=${modelId} cwd=${cwd} stream=${!!stream}`);

    let text;
    try {
      text = await runDevinPrint({ bin, args, cwd, signal, timeoutMs: 180_000 });
    } catch (err) {
      const msg = err?.message || String(err);
      log?.error?.("DEVIN-CLI", msg);
      return wrap(errorResponse(msg, 502, "DEVIN_CLI_FAILED"), body);
    }

    async function* once() {
      yield { delta: text };
      yield { done: true };
    }

    const response = stream
      ? buildStreamingResponse(once(), modelId)
      : await buildNonStreamingResponse(once(), modelId);

    return {
      response,
      url: "local://devin-cli",
      headers: {},
      transformedBody: { model: modelId, prompt },
    };
  }
}

function wrap(response, body) {
  return { response, url: "local://devin-cli", headers: {}, transformedBody: body };
}

function runDevinPrint({ bin, args, cwd, signal, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const out = [];
    const err = [];
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      finish(new Error(`Devin CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const onAbort = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      finish(new Error("Devin CLI aborted"));
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });

    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", (e) => finish(e));
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf8").trim();
      const stderr = Buffer.concat(err).toString("utf8").trim();
      if (code === 0 && stdout) {
        finish(null, stdout);
        return;
      }
      // Some builds print to stderr on success — prefer stdout, else stderr
      if (code === 0 && stderr) {
        finish(null, stderr);
        return;
      }
      finish(
        new Error(
          `Devin CLI exit ${code}: ${stderr || stdout || "no output"}. Is 'devin' installed and authenticated?`
        )
      );
    });

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
      if (error) reject(error);
      else resolve(value);
    }
  });
}

export default DevinCLIExecutor;
