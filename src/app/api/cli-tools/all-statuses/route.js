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

async function runGetter(name, getter, request) {
  try {
    const response = await getter(request);
    const payload = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: {
        error: error instanceof Error ? error.message : String(error || "Unknown error"),
      },
    };
  }
}

export async function GET(request) {
  const entries = await Promise.all(
    Object.entries(CLI_TOOL_GETTERS).map(async ([name, getter]) => [name, await runGetter(name, getter, request)])
  );

  const tools = Object.fromEntries(entries);
  const summary = Object.values(tools).reduce((acc, item) => {
    acc.total += 1;
    if (item.ok) acc.ok += 1;
    else acc.failed += 1;

    if (item.data?.installed === true) acc.installed += 1;
    else if (item.data?.installed === false) acc.notInstalled += 1;

    return acc;
  }, {
    total: 0,
    ok: 0,
    failed: 0,
    installed: 0,
    notInstalled: 0,
  });

  return NextResponse.json({
    summary,
    tools,
    generatedAt: new Date().toISOString(),
  });
}
