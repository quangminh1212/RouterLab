"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
  selectedPlugins: [],
  selectedSkills: [],
};

const SOURCE_OPTIONS = [
  { id: "all", label: "All sources" },
  { id: "openai-skills", label: "OpenAI Skills" },
  { id: "antigravity-awesome-skills", label: "Antigravity Awesome Skills" },
  { id: "claude-skills", label: "Claude Skills" },
  { id: "awesome-agent-skills", label: "Awesome Agent Skills" },
  { id: "xlab-curated", label: "XLab Curated" },
];

const SKILL_CATALOG = [
  {
    id: "openai-docs",
    name: "OpenAI Docs",
    category: "Research",
    source: "openai-skills",
    description: "Use official OpenAI docs workflows for API, SDK, and platform integration.",
    tags: ["openai", "docs", "api"],
    sourceUrl: "https://github.com/openai/skills",
    icon: "library_books",
  },
  {
    id: "plugin-creator",
    name: "Plugin Creator",
    category: "Agent Engineering",
    source: "openai-skills",
    description: "Create and iterate plugin-style capability bundles for reusable tasks.",
    tags: ["plugin", "agent", "tooling"],
    sourceUrl: "https://github.com/openai/skills",
    icon: "extension",
  },
  {
    id: "skill-creator",
    name: "Skill Creator",
    category: "Agent Engineering",
    source: "openai-skills",
    description: "Design new skills with reusable structure and strong task constraints.",
    tags: ["skill", "prompt", "automation"],
    sourceUrl: "https://github.com/openai/skills",
    icon: "construction",
  },
  {
    id: "agent-tool-builder",
    name: "Agent Tool Builder",
    category: "Agent Engineering",
    source: "antigravity-awesome-skills",
    description: "Build robust tool interfaces for autonomous agent workflows.",
    tags: ["tools", "agents", "architecture"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "build",
  },
  {
    id: "agent-memory-systems",
    name: "Agent Memory Systems",
    category: "Agent Engineering",
    source: "antigravity-awesome-skills",
    description: "Design memory layers and retrieval strategies for long-running agents.",
    tags: ["memory", "context", "agent"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "account_tree",
  },
  {
    id: "agent-orchestration-multi-agent-optimize",
    name: "Multi-Agent Orchestration",
    category: "Agent Engineering",
    source: "antigravity-awesome-skills",
    description: "Coordinate multiple agents for parallel workflows and better throughput.",
    tags: ["multi-agent", "orchestration", "coordination"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "hub",
  },
  {
    id: "ai-engineer",
    name: "AI Engineer",
    category: "AI Development",
    source: "antigravity-awesome-skills",
    description: "Production-grade LLM apps, RAG patterns, and model integration practices.",
    tags: ["llm", "rag", "engineering"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "psychology",
  },
  {
    id: "ai-agents-architect",
    name: "AI Agents Architect",
    category: "AI Development",
    source: "antigravity-awesome-skills",
    description: "Architect autonomous agents with memory, planning, and tool use.",
    tags: ["agent", "architecture", "planning"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "schema",
  },
  {
    id: "nextjs-best-practices",
    name: "Next.js Best Practices",
    category: "Web Development",
    source: "antigravity-awesome-skills",
    description: "Apply modern Next.js App Router patterns for maintainable web apps.",
    tags: ["nextjs", "react", "web"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "web",
  },
  {
    id: "react-component-architecture",
    name: "React Component Architecture",
    category: "Web Development",
    source: "claude-skills",
    description: "Organize reusable React components with clear boundaries and state flow.",
    tags: ["react", "component", "frontend"],
    sourceUrl: "https://github.com/alirezarezvani/claude-skills",
    icon: "view_quilt",
  },
  {
    id: "typescript-patterns",
    name: "TypeScript Patterns",
    category: "Coding",
    source: "claude-skills",
    description: "Use practical TypeScript typing and structure patterns in large projects.",
    tags: ["typescript", "patterns", "code"],
    sourceUrl: "https://github.com/alirezarezvani/claude-skills",
    icon: "code",
  },
  {
    id: "backend-patterns",
    name: "Backend Patterns",
    category: "Backend",
    source: "antigravity-awesome-skills",
    description: "Scalable API and service structure patterns for backend systems.",
    tags: ["backend", "api", "architecture"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "dns",
  },
  {
    id: "api-design-principles",
    name: "API Design Principles",
    category: "Backend",
    source: "antigravity-awesome-skills",
    description: "Design clean, predictable REST/GraphQL APIs for long-term maintenance.",
    tags: ["api", "rest", "graphql"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "api",
  },
  {
    id: "database-performance-tuning",
    name: "Database Performance Tuning",
    category: "Backend",
    source: "awesome-agent-skills",
    description: "Improve query and indexing strategy for stable high-load systems.",
    tags: ["database", "performance", "sql"],
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    icon: "database",
  },
  {
    id: "security-scanning-tools",
    name: "Security Scanning Tools",
    category: "Security",
    source: "antigravity-awesome-skills",
    description: "Run practical security scans and review findings for code and infra.",
    tags: ["security", "scan", "audit"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "security",
  },
  {
    id: "api-security-best-practices",
    name: "API Security Best Practices",
    category: "Security",
    source: "antigravity-awesome-skills",
    description: "Harden API surfaces with validation, auth guards, and threat reduction.",
    tags: ["security", "api", "auth"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "verified_user",
  },
  {
    id: "architect-review",
    name: "Architect Review",
    category: "Quality",
    source: "antigravity-awesome-skills",
    description: "Review architecture and implementation decisions with trade-off focus.",
    tags: ["review", "architecture", "quality"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "fact_check",
  },
  {
    id: "address-github-comments",
    name: "Address GitHub Comments",
    category: "Quality",
    source: "antigravity-awesome-skills",
    description: "Systematically resolve PR feedback and sync implementation updates.",
    tags: ["github", "review", "pr"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "rate_review",
  },
  {
    id: "agent-evaluation",
    name: "Agent Evaluation",
    category: "Quality",
    source: "antigravity-awesome-skills",
    description: "Benchmark and evaluate agent behavior with repeatable checks.",
    tags: ["evaluation", "benchmark", "agent"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "monitoring",
  },
  {
    id: "tdd-workflow",
    name: "TDD Workflow",
    category: "Quality",
    source: "xlab-curated",
    description: "Run test-first loops quickly for safer feature and refactor delivery.",
    tags: ["tdd", "tests", "workflow"],
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    icon: "check_circle",
  },
  {
    id: "debugging-workflow",
    name: "Debugging Workflow",
    category: "Quality",
    source: "xlab-curated",
    description: "Use structured debugging flow to isolate and fix root causes faster.",
    tags: ["debug", "troubleshoot", "workflow"],
    sourceUrl: "https://github.com/openai/skills",
    icon: "bug_report",
  },
  {
    id: "release-readiness",
    name: "Release Readiness",
    category: "Delivery",
    source: "xlab-curated",
    description: "Checklist for build, smoke test, rollback, and release confidence.",
    tags: ["release", "deploy", "checklist"],
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    icon: "rocket_launch",
  },
  {
    id: "devops-ci-cd",
    name: "DevOps CI/CD",
    category: "Delivery",
    source: "awesome-agent-skills",
    description: "Automate CI/CD pipelines with validation gates and deployment hygiene.",
    tags: ["ci", "cd", "devops"],
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    icon: "settings_suggest",
  },
  {
    id: "product-requirements-breakdown",
    name: "Requirements Breakdown",
    category: "Product",
    source: "xlab-curated",
    description: "Turn product intent into clear tasks, acceptance criteria, and milestones.",
    tags: ["product", "planning", "requirements"],
    sourceUrl: "https://github.com/openai/skills",
    icon: "assignment",
  },
  {
    id: "analytics-tracking",
    name: "Analytics Tracking",
    category: "Product",
    source: "antigravity-awesome-skills",
    description: "Define reliable event tracking and analysis loop for product decisions.",
    tags: ["analytics", "tracking", "product"],
    sourceUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    icon: "insights",
  },
  {
    id: "ux-a11y-audit",
    name: "UX + A11y Audit",
    category: "Web Development",
    source: "awesome-agent-skills",
    description: "Audit accessibility and usability to improve real-world product quality.",
    tags: ["accessibility", "ux", "audit"],
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    icon: "accessibility",
  },
  {
    id: "prompt-optimization",
    name: "Prompt Optimization",
    category: "AI Development",
    source: "claude-skills",
    description: "Refine prompts, constraints, and output contracts for stable agent behavior.",
    tags: ["prompt", "llm", "optimization"],
    sourceUrl: "https://github.com/alirezarezvani/claude-skills",
    icon: "tune",
  },
  {
    id: "cost-optimization-agents",
    name: "Agent Cost Optimization",
    category: "AI Development",
    source: "awesome-agent-skills",
    description: "Reduce model and tool cost while keeping response quality predictable.",
    tags: ["cost", "optimization", "agent"],
    sourceUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    icon: "savings",
  },
];

function cloneAiIntegrations(value) {
  const source = value && typeof value === "object" ? value : EMPTY_AI_INTEGRATIONS;
  return {
    enabled: source.enabled === true,
    autoConnect: source.autoConnect === true,
    mcpServers: Array.isArray(source.mcpServers) ? source.mcpServers.map((item) => ({ ...item })) : [],
    plugins: Array.isArray(source.plugins) ? source.plugins.map((item) => ({ ...item })) : [],
    selectedPlugins: Array.isArray(source.selectedPlugins) ? source.selectedPlugins.map((item) => ({ ...item })) : [],
    selectedSkills: Array.isArray(source.selectedSkills) ? source.selectedSkills.map((item) => ({ ...item })) : [],
  };
}

function inferSkillCategory(skill) {
  const text = `${skill?.name || ""} ${skill?.description || ""}`.toLowerCase();
  if (text.includes("security") || text.includes("pentest") || text.includes("vulnerability")) return "Security";
  if (text.includes("agent") || text.includes("orchestration") || text.includes("memory")) return "Agent Engineering";
  if (text.includes("react") || text.includes("next") || text.includes("frontend") || text.includes("ui")) return "Web Development";
  if (text.includes("api") || text.includes("backend") || text.includes("database")) return "Backend";
  if (text.includes("prompt") || text.includes("llm") || text.includes("rag") || text.includes("ai")) return "AI Development";
  return "Other";
}

function inferSkillIcon(skill) {
  const text = `${skill?.name || ""} ${skill?.description || ""}`.toLowerCase();
  if (text.includes("security") || text.includes("pentest") || text.includes("vulnerability")) return "security";
  if (text.includes("memory")) return "account_tree";
  if (text.includes("agent")) return "smart_toy";
  if (text.includes("react") || text.includes("next") || text.includes("web") || text.includes("ui")) return "web";
  if (text.includes("api") || text.includes("backend")) return "code";
  if (text.includes("database") || text.includes("sql")) return "database";
  if (text.includes("prompt") || text.includes("llm") || text.includes("ai")) return "psychology";
  return "extension";
}

function inferSkillTags(skill) {
  const text = `${skill?.name || ""} ${skill?.description || ""}`.toLowerCase();
  const tags = [];
  const candidates = ["agent", "ai", "llm", "prompt", "memory", "security", "react", "nextjs", "api", "backend", "database", "frontend", "automation", "testing", "docs"];
  for (const tag of candidates) {
    if (text.includes(tag.replace("nextjs", "next"))) tags.push(tag);
    if (tags.length >= 3) break;
  }
  return tags;
}

function normalizeSkill(skill) {
  return {
    ...skill,
    id: typeof skill?.id === "string" && skill.id.trim()
      ? skill.id.trim()
      : String(skill?.name || "skill").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-"),
    name: skill?.name || "Unnamed Skill",
    description: skill?.description || "No description",
    source: skill?.source || "local-skill-finder",
    sourceLabel: skill?.sourceLabel || skill?.source || "local-skill-finder",
    category: skill?.category || inferSkillCategory(skill),
    sourceUrl: skill?.sourceUrl || "",
    tags: Array.isArray(skill?.tags) ? skill.tags : inferSkillTags(skill),
    icon: skill?.icon || inferSkillIcon(skill),
  };
}

function normalizeSkillCatalog(skills) {
  const seenSignature = new Set();
  const idCounts = new Map();
  const output = [];

  for (const item of Array.isArray(skills) ? skills : []) {
    const normalized = normalizeSkill(item);
    const signature = `${normalized.id}|${normalized.name}|${normalized.description}|${normalized.source}`;
    if (seenSignature.has(signature)) continue;
    seenSignature.add(signature);

    const baseId = normalized.id;
    const nextCount = (idCounts.get(baseId) || 0) + 1;
    idCounts.set(baseId, nextCount);

    output.push({
      ...normalized,
      id: nextCount === 1 ? baseId : `${baseId}--${nextCount}`,
    });
  }

  return output;
}

function toSkillRecord(skill) {
  const normalized = normalizeSkill(skill);
  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    source: normalized.source,
    sourceLabel: normalized.sourceLabel,
    category: normalized.category,
    sourceUrl: normalized.sourceUrl,
    tags: normalized.tags,
  };
}

function getSkillKey(item) {
  return typeof item?.id === "string" ? item.id : "";
}

export default function AISkillsPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSkillId, setSavingSkillId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai-skills/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const skills = Array.isArray(data?.results) ? data.results : [];
        setSkillCatalog(normalizeSkillCatalog(skills.length > 0 ? skills : SKILL_CATALOG));
      })
      .catch(() => {
        if (!cancelled) setSkillCatalog(normalizeSkillCatalog(SKILL_CATALOG));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = cloneAiIntegrations(data?.aiIntegrations);
        setAiForm(next);
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load AI skills settings" }))
      .finally(() => setLoading(false));
  }, []);

  const enabledSkillIds = useMemo(
    () => new Set((Array.isArray(aiForm.selectedSkills) ? aiForm.selectedSkills : []).map(getSkillKey).filter(Boolean)),
    [aiForm.selectedSkills]
  );

  const filteredSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return skillCatalog.filter((skill) => {
      if (!keyword) return true;
      const category = typeof skill.category === "string" ? skill.category : "";
      const tags = Array.isArray(skill.tags) ? skill.tags.join(" ") : "";
      const text = `${skill.name || ""} ${skill.description || ""} ${category} ${tags}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [query, skillCatalog]);

  const groupedSkills = useMemo(() => {
    const groups = new Map();
    for (const skill of filteredSkills) {
      const group = skill.sourceLabel || skill.source || "Other";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(skill);
    }
    return Array.from(groups.entries());
  }, [filteredSkills]);

  const toggleSkill = async (skill) => {
    setSavingSkillId(skill.id);
    setStatus({ type: "", message: "" });
    try {
      const current = Array.isArray(aiForm.selectedSkills) ? aiForm.selectedSkills : [];
      const isEnabled = enabledSkillIds.has(skill.id);
      const selectedSkills = isEnabled
        ? current.filter((item) => getSkillKey(item) !== skill.id)
        : [...current.filter((item) => getSkillKey(item) !== skill.id), toSkillRecord(skill)];

      const nextForm = { ...aiForm, selectedSkills };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update AI skills");

      setAiForm(nextForm);
      setStatus({ type: "success", message: isEnabled ? `Disabled ${skill.name}` : `Enabled ${skill.name}` });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Skill update failed" });
    } finally {
      setSavingSkillId("");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[42px] leading-tight font-semibold text-text-main">Make Skills work your way</h1>
          <p className="text-text-muted mt-2">Enable skills from local skill-finder ({skillCatalog.length} available) for better task performance.</p>
        </div>

        <div>
          <Input
            label="Search skills"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or description..."
          />
        </div>

        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.02]">
          <div>
            <p className="text-sm text-text-muted">Enabled skills</p>
            <p className="text-xl font-semibold text-text-main">{enabledSkillIds.size}/{skillCatalog.length}</p>
          </div>
        </div>

        {loading || catalogLoading ? (
          <div className="rounded-xl border border-black/10 p-5 text-sm text-text-muted dark:border-white/10">Loading skills...</div>
        ) : groupedSkills.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-5 text-sm text-text-muted dark:border-white/10">No skills found.</div>
        ) : (
          <div className="space-y-8">
            {groupedSkills.map(([category, items]) => (
              <section key={category} className="space-y-3">
                <h2 className="text-[30px] font-semibold text-text-main">{category}</h2>
                <div className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {items.map((skill) => {
                    const enabled = enabledSkillIds.has(skill.id);
                    const saving = savingSkillId === skill.id;
                    return (
                      <div key={skill.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-text-main dark:bg-white/10">
                          <span className="material-symbols-outlined text-[18px]">{skill.icon}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-base font-semibold text-text-main">{skill.name}</p>
                            {enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{skill.sourceLabel || skill.source}</span>
                          </div>
                          <p className="text-xs text-text-muted line-clamp-1">{skill.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {skill.sourceUrl ? (
                              <a href={skill.sourceUrl} target="_blank" rel="noreferrer" className="rounded border border-black/10 px-2 py-0.5 text-[11px] text-text-muted hover:text-text-main dark:border-white/10">
                                repo
                              </a>
                            ) : null}
                            {(Array.isArray(skill.tags) ? skill.tags : []).slice(0, 3).map((tag, tagIndex) => (
                              <span key={`${skill.id}-tag-${tag}-${tagIndex}`} className="rounded bg-black/5 px-2 py-0.5 text-[11px] text-text-muted dark:bg-white/5">#{tag}</span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          disabled={saving || Boolean(savingSkillId)}
                          className={cn(
                            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                            enabled
                              ? "border-green-500/40 bg-green-500/10 text-green-500"
                              : "border-black/20 text-text-main hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
                            (saving || Boolean(savingSkillId)) && "opacity-60"
                          )}
                          title={enabled ? "Disable skill" : "Enable skill"}
                        >
                          <span className="material-symbols-outlined text-[17px]">{enabled ? "check" : "add"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {status.message ? <p className={cn("text-sm", status.type === "error" ? "text-red-500" : "text-green-500")}>{status.message}</p> : null}
      </div>
    </div>
  );
}

