import { NextResponse } from "next/server";
import { testSingleConnection } from "./testUtils.js";

// POST /api/providers/[id]/test - Test connection
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await testSingleConnection(id, {
      allModels: body?.allModels === true,
      timeoutMs: Number(body?.timeoutMs) || 120000,
    });

    if (result.error === "Connection not found") {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    return NextResponse.json({
      valid: result.valid,
      error: result.error,
      refreshed: result.refreshed || false,
      latencyMs: result.latencyMs || 0,
      testedAt: result.testedAt || null,
      summary: result.summary || null,
      models: result.models || null,
    });
  } catch (error) {
    console.log("Error testing connection:", error);
    return NextResponse.json({ error: "Test failed" }, { status: 500 });
  }
}
