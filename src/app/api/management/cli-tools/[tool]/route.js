import { NextResponse } from "next/server";
import { GET as getClaudeStatus } from "@/app/api/cli-tools/claude-settings/route";
import { GET as getCodexStatus } from "@/app/api/cli-tools/codex-settings/route";
import { GET as getCopilotStatus } from "@/app/api/cli-tools/copilot-settings/route";
import { GET as getCoworkStatus } from "@/app/api/cli-tools/cowork-settings/route";
import { GET as getDroidStatus } from "@/app/api/cli-tools/droid-settings/route";
import { GET as getHermesStatus } from "@/app/api/cli-tools/hermes-settings/route";
import { GET as getMitmStatus } from "@/app/api/cli-tools/antigravity-mitm/route";
import { GET as getOpenClawStatus } from "@/app/api/cli-tools/openclaw-settings/route";
import { GET as getOpenCodeStatus } from "@/app/api/cli-tools/opencode-settings/route";

const CLI_TOOL_GETTERS = {
  claude: getClaudeStatus,
  codex: getCodexStatus,
  copilot: getCopilotStatus,
  cowork: getCoworkStatus,
  droid: getDroidStatus,
  hermes: getHermesStatus,
  mitm: getMitmStatus,
  openclaw: getOpenClawStatus,
  opencode: getOpenCodeStatus,
};

function normalizeHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "::1" || raw === "[::1]") return "::1";
  if (raw.startsWith("[::1]:")) return "::1";
  return raw.split(":")[0];
}

function isLocalRequest(request) {
  return [
    request.nextUrl?.hostname,
    request.headers.get("host"),
  ].some((value) => {
    const host = normalizeHost(value);
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  });
}

function deny() {
  return NextResponse.json({ error: "Management API is restricted to localhost" }, { status: 403 });
}

function invalidUpstreamResponse() {
  return NextResponse.json({ error: "Invalid upstream response" }, { status: 502 });
}

async function safeJsonFromResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}


export async function GET(request, { params }) {
  if (!isLocalRequest(request)) return deny();

  const resolvedParams = await params;
  const tool = String(resolvedParams?.tool || "").trim().toLowerCase();
  const getter = CLI_TOOL_GETTERS[tool];
  if (!getter) {
    return NextResponse.json({ error: `Unknown CLI tool: ${tool}` }, { status: 404 });
  }

  const response = await getter(request);
  const payload = await safeJsonFromResponse(response);
  if (payload === null) {
    return invalidUpstreamResponse();
  }

  return NextResponse.json(payload, { status: response.status });
}
