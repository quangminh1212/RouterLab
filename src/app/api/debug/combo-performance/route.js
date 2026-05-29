import { NextResponse } from "next/server";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { getComboPerformanceSnapshot } from "open-sse/services/combo.js";

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";
let cachedCliToken = null;

async function getCliToken() {
  if (!cachedCliToken) cachedCliToken = await getConsistentMachineId(CLI_TOKEN_SALT);
  return cachedCliToken;
}

function isLocalhostRequest(request) {
  const host = String(request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function hasValidCliToken(request) {
  const token = request.headers.get(CLI_TOKEN_HEADER);
  if (!token) return false;
  return token === await getCliToken();
}

export async function GET(request) {
  if (!isLocalhostRequest(request) && !(await hasValidCliToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getComboPerformanceSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
