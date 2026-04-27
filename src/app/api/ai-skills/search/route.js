import { NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

const SKILL_FINDER_PATH = path.join(os.homedir(), ".agent", "skills", "skill-finder", "SKILL.md");
const SKILLS_ROOT = path.join(os.homedir(), ".agent", "skills");
const MAX_SKILL_RESULTS = 1200;

function slugify(value) {
  return String(value || "skill").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function sourceFromSkillPath(filePath) {
  const relative = path.relative(SKILLS_ROOT, filePath).replace(/\\/g, "/");
  const parts = relative.split("/").filter(Boolean);
  const root = parts[0] || "local-skills";
  const localPath = path.join(SKILLS_ROOT, root);
  if (root === ".system") return { source: "openai-system", sourceLabel: "OpenAI/System Skills", sourceUrl: "https://github.com/openai/skills", localPath };
  if (root === "antigravity-awesome-skills") return { source: "antigravity-awesome-skills", sourceLabel: "Antigravity Awesome Skills", sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills", localPath };
  if (root === "game-development") return { source: "game-development", sourceLabel: "Game Development Skills", sourceUrl: "", localPath };
  if (root === "skill-finder") return { source: "skill-finder", sourceLabel: "Skill Finder", sourceUrl: "", localPath };
  return { source: root, sourceLabel: root.replace(/[-_]/g, " "), sourceUrl: "", localPath };
}

function parseFrontMatter(content) {
  const text = String(content || "");
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    result[pair[1]] = pair[2].replace(/^['"]|['"]$/g, "").trim();
  }
  return result;
}

async function collectSkillFiles(dir, depth = 0) {
  if (depth > 5) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "SKILL.md") files.push(fullPath);
    else if (entry.isDirectory()) files.push(...await collectSkillFiles(fullPath, depth + 1));
  }

  return files;
}

async function loadLocalSkills() {
  const files = await collectSkillFiles(SKILLS_ROOT);
  const items = [];

  for (const file of files) {
    if (file === SKILL_FINDER_PATH) continue;
    const content = await fs.readFile(file, "utf-8").catch(() => "");
    const meta = parseFrontMatter(content);
    const folderName = path.basename(path.dirname(file));
    const name = meta.name || folderName;
    const description = meta.description || "No description";
    const sourceInfo = sourceFromSkillPath(file);
    const relativePath = path.relative(SKILLS_ROOT, file).replace(/\\/g, "/");

    items.push({
      id: slugify(`${sourceInfo.source}-${name}`),
      name,
      description,
      ...sourceInfo,
      sourcePath: relativePath,
    });
  }

  return items;
}

function parseSkillFinderMarkdown(content) {
  const lines = String(content || "").split(/\r?\n/);
  const items = [];

  for (const line of lines) {
    const match = line.match(/^\s*-\s+(.+?)\s*\|\s*(.+)$/);
    if (!match) continue;
    const name = match[1].trim();
    const description = match[2].trim();
    if (!name) continue;
    const id = slugify(name);
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

    const localSkills = await loadLocalSkills();
    const raw = localSkills.length > 0 ? "" : await fs.readFile(SKILL_FINDER_PATH, "utf-8");
    const sourceItems = localSkills.length > 0 ? localSkills : parseSkillFinderMarkdown(raw);
    const items = sourceItems
      .filter((item) => matchesQuery(item, query))
      .slice(0, MAX_SKILL_RESULTS);

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
