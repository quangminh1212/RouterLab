import { NextResponse } from "next/server";
import { POST as postModelTest } from "@/app/api/models/test/route";

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

export async function POST(request) {
  if (!isLocalRequest(request)) return deny();
  return postModelTest(request);
}
