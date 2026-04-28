import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

function normalizeRule(raw, index) {
  const priority = Number(raw?.priority);
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `rule-${Date.now()}-${index}`,
    name: typeof raw?.name === "string" ? raw.name.trim() : "Rule mới",
    enabled: raw?.enabled !== false,
    content: typeof raw?.content === "string"
      ? raw.content
      : (typeof raw?.actionValue === "string" ? raw.actionValue : ""),
    priority: Number.isFinite(priority) ? priority : 100,
    applyType: typeof raw?.applyType === "string" ? raw.applyType : "always",
    applyValue: typeof raw?.applyValue === "string" ? raw.applyValue : "",
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const settings = await getSettings();
    const rules = Array.isArray(settings?.aiRules) ? settings.aiRules.map(normalizeRule) : [];
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load AI rules" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const incoming = Array.isArray(body?.rules) ? body.rules : [];
    const rules = incoming
      .map((item, index) => normalizeRule(item, index))
      .filter((item) => item.content.trim().length > 0)
      .sort((a, b) => a.priority - b.priority);

    const settings = await updateSettings({ aiRules: rules });
    return NextResponse.json({ rules: Array.isArray(settings?.aiRules) ? settings.aiRules : [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to save AI rules" }, { status: 500 });
  }
}
