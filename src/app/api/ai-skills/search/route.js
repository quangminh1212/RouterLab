import { NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

const SKILLS_ROOT = path.join(os.homedir(), ".agent", "skills");
const MAX_SKILL_RESULTS = 1200;
const CRAWLED_REPO_LIMIT = 80;
const CRAWL_CACHE_TTL_MS = 1000 * 60 * 60;

let crawledRepoCache = {
  expiresAt: 0,
  items: [],
};

const AWESOME_SKILL_SOURCES = [
  "https://raw.githubusercontent.com/e2b-dev/awesome-ai-agents/main/README.md",
  "https://raw.githubusercontent.com/github/awesome-copilot/main/README.md",
  "https://raw.githubusercontent.com/kodustech/awesome-agent-skills/main/README.md",
  "https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md",
];

const SKILL_REPO_KEYWORDS = [
  "agent",
  "agents",
  "ai-agent",
  "assistant",
  "automation",
  "claude",
  "codex",
  "copilot",
  "instruction",
  "instructions",
  "mcp",
  "prompt",
  "prompts",
  "skill",
  "skills",
  "subagent",
  "workflow",
  "workflows",
];

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
  {
    source: "agent-skills-addyosmani",
    sourceLabel: "Agent Skills (Addy Osmani)",
    sourceUrl: "https://github.com/addyosmani/agent-skills",
    description: "Reusable agent skills for modern software engineering, product workflows, and AI-assisted development.",
    skillCountHint: 50,
    tags: ["agent", "software", "skills"],
  },
  {
    source: "skills-antfu",
    sourceLabel: "Skills (Antfu)",
    sourceUrl: "https://github.com/antfu/skills",
    description: "Personal and community skill collection for agentic coding and reusable development workflows.",
    skillCountHint: 25,
    tags: ["coding", "agent", "skills"],
  },
  {
    source: "codex-skill-pack",
    sourceLabel: "Codex Skill Pack",
    sourceUrl: "https://github.com/reachmeshailesh-boop/codex-skill-pack",
    description: "Pack of Codex-focused skills and reusable instructions for software development tasks.",
    skillCountHint: 40,
    tags: ["codex", "pack", "skills"],
  },
  {
    source: "uberskills",
    sourceLabel: "Uberskills",
    sourceUrl: "https://github.com/uberskillsdev/uberskills",
    description: "Large skill repository for AI agents covering development, automation, research, and productivity workflows.",
    skillCountHint: 100,
    tags: ["agents", "automation", "skills"],
  },
  {
    source: "claude-skills-alirezarezvani",
    sourceLabel: "Claude Skills",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills",
    description: "Claude-oriented skill repository for coding, review, automation, and structured agent workflows.",
    skillCountHint: 50,
    tags: ["claude", "coding", "skills"],
  },
  {
    source: "claude-flow",
    sourceLabel: "Claude Flow",
    sourceUrl: "https://github.com/ruvnet/claude-flow",
    description: "Agent orchestration and workflow repository with reusable patterns for Claude-style multi-agent systems.",
    skillCountHint: 50,
    tags: ["claude", "multi-agent", "workflow"],
  },
  {
    source: "agents-wshobson",
    sourceLabel: "Agents (wshobson)",
    sourceUrl: "https://github.com/wshobson/agents",
    description: "Collection of specialized agent definitions and reusable workflows for development and operations.",
    skillCountHint: 50,
    tags: ["agents", "subagents", "workflows"],
  },
  {
    source: "promptbase-microsoft",
    sourceLabel: "Microsoft Promptbase",
    sourceUrl: "https://github.com/microsoft/promptbase",
    description: "Microsoft prompt and instruction examples that can be adapted into repo-level agent skills.",
    skillCountHint: 100,
    tags: ["prompts", "microsoft", "ai"],
  },
  {
    source: "awesome-ai-agents-e2b",
    sourceLabel: "Awesome AI Agents",
    sourceUrl: "https://github.com/e2b-dev/awesome-ai-agents",
    description: "Awesome list of AI agent projects and patterns useful for discovering additional agent skill repositories.",
    skillCountHint: 100,
    tags: ["awesome", "agents", "ai"],
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
      const sourceUrl = await readRepoOriginUrl(repoRoot);
      repoInfo = {
        source,
        sourceLabel: prettifyRepoLabel(path.basename(repoRoot)),
        sourceUrl,
        iconUrl: githubOwnerAvatarUrl(sourceUrl),
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


function normalizeGithubRepoUrl(url) {
  const match = String(url || "").match(/^https:\/\/github\.com\/([^\s/?#)]+)\/([^\s/?#)]+)(?:[/?#][^\s)]*)?$/i);
  if (!match) return "";
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) return "";
  return `https://github.com/${owner}/${repo}`;
}

function repoSlugFromUrl(url) {
  const match = String(url || "").match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  return match ? slugify(`${match[1]}-${match[2]}`) : "";
}

function githubOwnerAvatarUrl(url) {
  const match = String(url || "").match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (!match) return "";
  return `https://github.com/${match[1]}.png?size=64`;
}

function isSkillRepoCandidate(text) {
  const haystack = String(text || "").toLowerCase();
  return SKILL_REPO_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function extractGithubRepoLinks(markdown) {
  const candidates = new Map();
  const linkPattern = /\[([^\]]+)\]\((https:\/\/github\.com\/[^\s)]+)\)/gi;
  let match;

  while ((match = linkPattern.exec(markdown))) {
    const label = match[1].replace(/[`*_]/g, " ").trim();
    const url = normalizeGithubRepoUrl(match[2]);
    if (!url) continue;

    const lineStart = markdown.lastIndexOf("\n", match.index) + 1;
    const lineEnd = markdown.indexOf("\n", match.index);
    const line = markdown.slice(lineStart, lineEnd === -1 ? markdown.length : lineEnd).trim();
    const context = `${label} ${line}`;
    if (!isSkillRepoCandidate(context)) continue;

    candidates.set(url.toLowerCase(), { url, label, context });
  }

  return [...candidates.values()];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/plain, text/markdown, */*",
      "user-agent": "XLab-Router-Skill-Catalog",
    },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return "";
  return response.text();
}

async function verifyGithubRepo(candidate) {
  const match = candidate.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (!match) return null;

  const [, owner, repo] = match;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "XLab-Router-Skill-Catalog",
    },
    next: { revalidate: 3600 },
  }).catch(() => null);
  if (!response?.ok) return null;

  const data = await response.json().catch(() => ({}));
  if (data?.archived || data?.disabled || data?.private) return null;

  const description = data.description || candidate.context || "Verified GitHub repository related to AI agent skills, prompts, instructions, or workflows.";
  const searchText = `${data.full_name} ${description} ${data.topics?.join(" ") || ""}`;
  if (!isSkillRepoCandidate(searchText)) return null;

  const displayName = prettifyRepoLabel(candidate.label || data.name || repo);

  return {
    id: `repo-${repoSlugFromUrl(candidate.url)}`,
    name: displayName,
    source: repoSlugFromUrl(candidate.url),
    sourceLabel: displayName,
    sourceUrl: data.html_url || candidate.url,
    iconUrl: data.owner?.avatar_url || githubOwnerAvatarUrl(data.html_url || candidate.url),
    description,
    category: "Repository",
    sourcePath: "",
    localPath: "",
    icon: "folder_special",
    skillCountHint: Math.max(10, Math.min(100, Math.round((data.stargazers_count || 0) / 10) || 10)),
    tags: ["github", "crawler", "skills"],
  };
}

async function loadCrawledSkillRepos() {
  if (Date.now() < crawledRepoCache.expiresAt) return crawledRepoCache.items;

  const markdownList = await Promise.all(AWESOME_SKILL_SOURCES.map((url) => fetchText(url).catch(() => "")));
  const candidates = [];
  const seen = new Set();

  for (const markdown of markdownList) {
    for (const candidate of extractGithubRepoLinks(markdown)) {
      const key = candidate.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  const verified = [];
  for (const candidate of candidates) {
    if (verified.length >= CRAWLED_REPO_LIMIT) break;
    const repo = await verifyGithubRepo(candidate);
    if (repo) verified.push(repo);
  }

  crawledRepoCache = {
    expiresAt: Date.now() + CRAWL_CACHE_TTL_MS,
    items: verified,
  };
  return verified;
}

function loadCuratedSkillRepos() {
  return CURATED_SKILL_REPOS.map((repo) => ({
    id: `repo-${repo.source}`,
    name: repo.sourceLabel,
    category: "Repository",
    sourcePath: "",
    localPath: "",
    iconUrl: githubOwnerAvatarUrl(repo.sourceUrl),
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
    const curatedSources = new Set(curatedRepos.map((repo) => repo.source));

    const crawledRepos = (await loadCrawledSkillRepos()).filter(
      (repo) => repo?.source && !localSources.has(repo.source) && !curatedSources.has(repo.source)
    );

    const uniqueRepos = new Map();
    for (const repo of [...curatedRepos, ...crawledRepos]) {
      if (!repo?.source || uniqueRepos.has(repo.source)) continue;
      uniqueRepos.set(repo.source, repo);
    }

    const items = [...localSkills, ...uniqueRepos.values()]
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
