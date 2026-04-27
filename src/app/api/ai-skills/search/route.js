import { NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

const SKILLS_ROOT = path.join(os.homedir(), ".agent", "skills");
const MAX_SKILL_RESULTS = 1200;

const CURATED_SKILL_REPOS = [
  {
    source: "openai-skills",
    sourceLabel: "OpenAI Skills",
    sourceUrl: "https://github.com/openai/skills",
    description: "Official OpenAI skill examples and system skills for reusable agent workflows.",
    skillCountHint: 5,
    tags: ["openai", "codex", "skills"],
  },
  {
    source: "anthropic-skills",
    sourceLabel: "Anthropic Skills",
    sourceUrl: "https://github.com/anthropics/skills",
    description: "Anthropic skill examples and reusable task instructions for Claude-style agents.",
    skillCountHint: 10,
    tags: ["claude", "agents", "skills"],
  },
  {
    source: "awesome-agent-skills-kodustech",
    sourceLabel: "Awesome Agent Skills (KodusTech)",
    sourceUrl: "https://github.com/kodustech/awesome-agent-skills",
    description: "A broad collection of agent skills for coding, product, workflow, and automation tasks.",
    skillCountHint: 100,
    tags: ["awesome", "agent", "skills"],
  },
  {
    source: "awesome-agent-skills-voltagent",
    sourceLabel: "Awesome Agent Skills (VoltAgent)",
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    description: "Curated agent skills and workflow patterns for AI engineering and automation.",
    skillCountHint: 100,
    tags: ["awesome", "workflow", "agents"],
  },
  {
    source: "skills-supply",
    sourceLabel: "Skills Supply",
    sourceUrl: "https://github.com/803/skills-supply",
    description: "Community skill repository with reusable agent capabilities and task playbooks.",
    skillCountHint: 50,
    tags: ["community", "agents", "skills"],
  },
  {
    source: "codex-skills-vadimcomanescu",
    sourceLabel: "Codex Skills",
    sourceUrl: "https://github.com/vadimcomanescu/codex-skills",
    description: "Codex-oriented skills for software development workflows and reusable automation.",
    skillCountHint: 25,
    tags: ["codex", "coding", "skills"],
  },
  {
    source: "agent-skills-simota",
    sourceLabel: "Agent Skills",
    sourceUrl: "https://github.com/simota/agent-skills",
    description: "Reusable agent skills for common development and productivity tasks.",
    skillCountHint: 25,
    tags: ["agent", "productivity", "skills"],
  },
  {
    source: "codex-skills-library",
    sourceLabel: "Codex Skills Library",
    sourceUrl: "https://github.com/proflead/codex-skills-library",
    description: "Library of Codex skills covering coding workflows, reviews, and automation patterns.",
    skillCountHint: 50,
    tags: ["codex", "library", "coding"],
  },
  {
    source: "ai-agents-skills",
    sourceLabel: "AI Agents Skills",
    sourceUrl: "https://github.com/hoodini/ai-agents-skills",
    description: "AI agent skill repository for task execution, automation, and agent orchestration.",
    skillCountHint: 30,
    tags: ["ai", "agents", "skills"],
  },
  {
    source: "awesome-copilot",
    sourceLabel: "Awesome Copilot",
    sourceUrl: "https://github.com/github/awesome-copilot",
    description: "Community repository of Copilot instructions, prompts, and reusable coding workflows.",
    skillCountHint: 100,
    tags: ["copilot", "instructions", "coding"],
  },
];

function slugify(value) {
  return String(value || "skill").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function prettifyRepoLabel(name) {
  return String(name || "repo")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function findRepoRoot(startPath) {
  let current = path.dirname(startPath);
  const rootResolved = path.resolve(SKILLS_ROOT);

  while (current.startsWith(rootResolved)) {
    const gitDir = path.join(current, ".git");
    const isRepo = await fs.stat(gitDir).then((stat) => stat.isDirectory() || stat.isFile()).catch(() => false);
    if (isRepo) return current;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return "";
}

async function readRepoOriginUrl(repoRoot) {
  const configPath = path.join(repoRoot, ".git", "config");
  const text = await fs.readFile(configPath, "utf-8").catch(() => "");
  if (!text) return "";

  const originMatch = text.match(/\[remote\s+"origin"\]([\s\S]*?)(?:\n\[|$)/i);
  if (!originMatch) return "";
  const urlMatch = originMatch[1].match(/\n\s*url\s*=\s*(.+)\s*$/im);
  return urlMatch ? urlMatch[1].trim() : "";
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
  const repoCache = new Map();

  for (const file of files) {
    const repoRoot = await findRepoRoot(file);
    if (!repoRoot) continue;

    let repoInfo = repoCache.get(repoRoot);
    if (!repoInfo) {
      const source = slugify(path.basename(repoRoot));
      repoInfo = {
        source,
        sourceLabel: prettifyRepoLabel(path.basename(repoRoot)),
        sourceUrl: await readRepoOriginUrl(repoRoot),
        localPath: repoRoot,
      };
      repoCache.set(repoRoot, repoInfo);
    }

    const content = await fs.readFile(file, "utf-8").catch(() => "");
    const meta = parseFrontMatter(content);
    const folderName = path.basename(path.dirname(file));
    const name = meta.name || folderName;
    const description = meta.description || "No description";
    const relativePath = path.relative(repoRoot, file).replace(/\\/g, "/");

    items.push({
      id: slugify(`${repoInfo.source}-${name}`),
      name,
      description,
      ...repoInfo,
      sourcePath: relativePath,
    });
  }

  return items;
}

function loadCuratedSkillRepos() {
  return CURATED_SKILL_REPOS.map((repo) => ({
    id: `repo-${repo.source}`,
    name: repo.sourceLabel,
    category: "Repository",
    sourcePath: "",
    localPath: "",
    icon: "folder_special",
    ...repo,
  }));
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
    const localSources = new Set(localSkills.map((item) => item.source));
    const curatedRepos = loadCuratedSkillRepos().filter((repo) => !localSources.has(repo.source));
    const items = [...localSkills, ...curatedRepos]
      .filter((item) => matchesQuery(item, query))
      .slice(0, MAX_SKILL_RESULTS);

    return NextResponse.json({
      results: items,
      source: SKILLS_ROOT,
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
