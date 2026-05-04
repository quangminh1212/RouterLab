import { NextResponse } from "next/server";

export async function POST(request) {
  const startedAt = Date.now();
  try {
    return NextResponse.json({ error: "Password login has been removed. Use OAuth QR login." }, { status: 410 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 100) {
      console.log(`[PERF] POST /api/auth/login took ${durationMs}ms`);
    }
  }
}
