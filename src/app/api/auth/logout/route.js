import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function isCrossSiteUnsafeRequest(request) {
  const secFetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || "";
  if (!origin || !host) return false;

  try {
    return new URL(origin).host.toLowerCase() !== host.toLowerCase();
  } catch {
    return true;
  }
}

export async function POST(request) {
  if (isCrossSiteUnsafeRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
  return NextResponse.json({ success: true });
}
