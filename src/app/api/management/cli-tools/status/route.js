import { NextResponse } from "next/server";
import { GET as getAllStatuses } from "@/app/api/cli-tools/all-statuses/route";

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


export async function GET(request) {
  if (!isLocalRequest(request)) return deny();

  const response = await getAllStatuses(request);
  const payload = await safeJsonFromResponse(response);
  if (payload === null) {
    return invalidUpstreamResponse();
  }

  return NextResponse.json(payload, { status: response.status });
}
