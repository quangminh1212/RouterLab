import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { BaseExecutor } from "./base.js";

/**
 * Local Augment CLI ("auggie") pipe executor.
 * OmniRoute: open-sse/executors/auggie.ts (simplified)
 */

const DEFAULT_MODEL = "sonnet4.6";

function resolveAuggieBin() {
  if (process.env.AUGGIE_BIN) return process.env.AUGGIE_BIN;
  if (process.env.CLI_AUGGIE_BIN) return process.env.CLI_AUGGIE_BIN;

  const candidates = [];
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    if (local) candidates.push(path.join(local, "auggie", "bin", "auggie.exe"));
    candidates.push("auggie.cmd", "auggie.exe", "auggie");
  } else {
    candidates.push(
      path.join(os.homedir(), ".local", "share", "auggie", "bin", "auggie"),
      path.join(os.homedir(), ".auggie", "bin", "auggie"),
      "auggie"
    );
  }
  for (const c of candidates) {
    if (c.includes(path.sep) || c.includes("/")) {
      if (fs.existsSync(c)) return c;
    } else {
      return c; // PATH lookup via spawn
    }
  }
  return "auggie";
}

function flattenMessages(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((m) => {
      const role = m?.role || "user";
      const content =
        typeof m?.content === "string"
          ? m.content
          : Array.isArray(m?.content)
            ? m.content.map((p) => p?.text || "").join("")
            : JSON.stringify(m?.content ?? "");
      return `${role.toUpperCase()}: ${content}`;
    })
    .join("\n\n");
}

function sanitizeModel(model) {
  const id = String(model || DEFAULT_MODEL).trim();
  // Defense against argv injection
  if (!id || id.startsWith("-") || /[\s"'`;|&$]/.test(id)) return DEFAULT_MODEL;
  return id;
}

export class AuggieExecutor extends BaseExecutor {
  constructor() {
    super("auggie", { format: "openai", noAuth: true, baseUrl: "auggie://cli/stdio" });
  }

  buildUrl() {
    return "auggie://cli/stdio";
  }

  async execute({ model, body, stream, signal, log }) {
    const prompt = flattenMessages(body?.messages);
    const modelId = sanitizeModel(model || body?.model);
    let bin;
    try {
      bin = resolveAuggieBin();
    } catch (e) {
      const err = JSON.stringify({
        error: { message: `Auggie binary not found: ${e.message}`, type: "provider_error" },
      });
      return {
        response: new Response(err, { status: 503, headers: { "Content-Type": "application/json" } }),
        url: "auggie://cli/stdio",
        headers: {},
        transformedBody: body,
      };
    }

    log?.debug?.("FETCH", `AUGGIE → ${bin} --print --model ${modelId}`);

    const chunks = [];
    let stderr = "";
    const child = spawn(bin, ["--print", "--quiet", "--model", modelId], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    const onAbort = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });

    child.stdout.on("data", (d) => chunks.push(Buffer.from(d)));
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.stdin.write(prompt);
    child.stdin.end();

    const exitCode = await new Promise((resolve) => {
      child.on("close", (code) => resolve(code ?? 1));
      child.on("error", () => resolve(1));
    });
    signal?.removeEventListener?.("abort", onAbort);

    const content = Buffer.concat(chunks).toString("utf8").trim();
    if (exitCode !== 0 && !content) {
      const err = JSON.stringify({
        error: {
          message: stderr || `Auggie exited with code ${exitCode}`,
          type: "provider_error",
        },
      });
      return {
        response: new Response(err, { status: 502, headers: { "Content-Type": "application/json" } }),
        url: "auggie://cli/stdio",
        headers: {},
        transformedBody: body,
      };
    }

    if (stream) {
      const id = `chatcmpl-auggie-${Date.now()}`;
      const sse =
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
        })}\n\n` +
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        })}\n\n` +
        "data: [DONE]\n\n";
      return {
        response: new Response(sse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
        url: "auggie://cli/stdio",
        headers: {},
        transformedBody: body,
      };
    }

    const json = JSON.stringify({
      id: `chatcmpl-auggie-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [
        { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
    return {
      response: new Response(json, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      url: "auggie://cli/stdio",
      headers: {},
      transformedBody: body,
    };
  }
}

export default AuggieExecutor;
