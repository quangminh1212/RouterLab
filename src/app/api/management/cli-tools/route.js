import { NextResponse } from "next/server";

const CLI_TOOLS = [
  { id: "claude", statusEndpoint: "/api/management/cli-tools/claude" },
  { id: "codex", statusEndpoint: "/api/management/cli-tools/codex" },
  { id: "copilot", statusEndpoint: "/api/management/cli-tools/copilot" },
  { id: "cowork", statusEndpoint: "/api/management/cli-tools/cowork" },
  { id: "droid", statusEndpoint: "/api/management/cli-tools/droid" },
  { id: "hermes", statusEndpoint: "/api/management/cli-tools/hermes" },
  { id: "mitm", statusEndpoint: "/api/management/cli-tools/mitm" },
  { id: "openclaw", statusEndpoint: "/api/management/cli-tools/openclaw" },
  { id: "opencode", statusEndpoint: "/api/management/cli-tools/opencode" },
];

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
    request.headers.get("x-forwarded-host"),
  ].some((value) => {
    const host = normalizeHost(value);
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  });
}

function deny() {
  return NextResponse.json({ error: "Management API is restricted to localhost" }, { status: 403 });
}

export async function GET(request) {
  if (!isLocalRequest(request)) return deny();

  return NextResponse.json({
    tools: CLI_TOOLS,
    count: CLI_TOOLS.length,
    summaryEndpoint: "/api/management/cli-tools/status",
  });
}
