import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

function normalizePriority(rawPriority) {
  if (typeof rawPriority === "string") {
    const normalized = rawPriority.trim().toLowerCase();
    if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      if (numeric <= 1) return "high";
      if (numeric >= 3) return "low";
    }
  }
  const numeric = Number(rawPriority);
  if (Number.isFinite(numeric)) {
    if (numeric <= 1) return "high";
    if (numeric >= 3) return "low";
  }
  return "medium";
}

function getPriorityRank(priority) {
  if (priority === "high") return 1;
  if (priority === "low") return 3;
  return 2;
}

function normalizeRule(raw, index) {
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `rule-${Date.now()}-${index}`,
    name: typeof raw?.name === "string" ? raw.name.trim() : "Rule m?i",
    enabled: raw?.enabled !== false,
    content: typeof raw?.content === "string" ? raw.content : (typeof raw?.actionValue === "string" ? raw.actionValue : ""),
    priority: normalizePriority(raw?.priority),
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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const incoming = Array.isArray(body?.rules) ? body.rules : [];
    const rules = incoming
      .map((item, index) => normalizeRule(item, index))
      .filter((item) => item.content.trim().length > 0)
      .sort((a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority));

    const settings = await updateSettings({ aiRules: rules });
    return NextResponse.json({ rules: Array.isArray(settings?.aiRules) ? settings.aiRules : [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to save AI rules" }, { status: 500 });
  }
}
