import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { normalizePayloadRules } from "open-sse/services/payloadRules.js";

// GET /api/settings/payload-rules — list payload rules
export async function GET() {
  try {
    const settings = await getSettings();
    const rules = normalizePayloadRules(settings?.payloadRules);
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load payload rules" }, { status: 500 });
  }
}

// PUT /api/settings/payload-rules — replace payload rules
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const rules = normalizePayloadRules(Array.isArray(body?.rules) ? body.rules : []);
    const settings = await updateSettings({ payloadRules: rules });
    return NextResponse.json({ rules: normalizePayloadRules(settings?.payloadRules) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to save payload rules" }, { status: 500 });
  }
}
