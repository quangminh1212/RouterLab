import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

function normalizeRule(raw, index) {
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `rule-${Date.now()}-${index}`,
    name: typeof raw?.name === "string" ? raw.name.trim() : "",
    enabled: raw?.enabled !== false,
    trigger: typeof raw?.trigger === "string" ? raw.trigger.trim() : "contains",
    matchText: typeof raw?.matchText === "string" ? raw.matchText.trim() : "",
    target: typeof raw?.target === "string" ? raw.target.trim() : "all",
    actionType: typeof raw?.actionType === "string" ? raw.actionType.trim() : "prepend-system",
    actionValue: typeof raw?.actionValue === "string" ? raw.actionValue : "",
    priority: Number.isFinite(Number(raw?.priority)) ? Number(raw.priority) : 100,
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
      .filter((item) => item.name && item.matchText && item.actionValue)
      .sort((a, b) => a.priority - b.priority);

    const settings = await updateSettings({ aiRules: rules });
    return NextResponse.json({ rules: Array.isArray(settings?.aiRules) ? settings.aiRules : [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to save AI rules" }, { status: 500 });
  }
}

