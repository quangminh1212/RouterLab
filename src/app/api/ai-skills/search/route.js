import { NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

const SKILL_FINDER_PATH = path.join(os.homedir(), ".agent", "skills", "skill-finder", "SKILL.md");

function parseSkillFinderMarkdown(content) {
  const lines = String(content || "").split(/\r?\n/);
  const items = [];

  for (const line of lines) {
    const match = line.match(/^\s*-\s+(.+?)\s*\|\s*(.+)$/);
    if (!match) continue;
    const name = match[1].trim();
    const description = match[2].trim();
    if (!name) continue;
    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
    items.push({ id, name, description, source: "local-skill-finder" });
  }

  return items;
}

function matchesQuery(item, query) {
  if (!query) return true;
  const haystack = `${item.name} ${item.description}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    const raw = await fs.readFile(SKILL_FINDER_PATH, "utf-8");
    const items = parseSkillFinderMarkdown(raw)
      .filter((item) => matchesQuery(item, query))
      .slice(0, 300);

    return NextResponse.json({
      results: items,
      source: SKILL_FINDER_PATH,
      total: items.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load skills from local skill-finder",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
