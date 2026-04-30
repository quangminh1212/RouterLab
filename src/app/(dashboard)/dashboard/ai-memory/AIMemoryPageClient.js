"use client";

import { useMemo, useState } from "react";
import { Card, Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const MEMORY_REPOS = [
  {
    id: "mcp-modelcontextprotocol-memory",
    name: "MCP Memory Server",
    repo: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    description: "Knowledge graph memory server chính thức của Model Context Protocol.",
    tags: ["mcp", "memory", "knowledge-graph"],
  },
  {
    id: "mcp-mem0",
    name: "Mem0 MCP",
    repo: "https://github.com/mem0ai/mem0-mcp",
    description: "MCP server cho long-term memory và semantic retrieval.",
    tags: ["mcp", "memory", "semantic-search"],
  },
  {
    id: "mcp-memory-bank",
    name: "Memory Bank MCP",
    repo: "https://github.com/alioshr/memory-bank-mcp",
    description: "Bộ nhớ lâu dài tối ưu cho agent workflow chạy dài hạn.",
    tags: ["mcp", "persistent-memory", "agent"],
  },
  {
    id: "mcp-supermemory",
    name: "Supermemory MCP",
    repo: "https://github.com/supermemoryai/supermemory-mcp",
    description: "Kết nối công cụ Supermemory để lưu và truy hồi tri thức cá nhân.",
    tags: ["mcp", "memory", "knowledge-base"],
  },
  {
    id: "mcp-letta",
    name: "Letta MCP Server",
    repo: "https://github.com/letta-ai/letta-mcp-server",
    description: "MCP server cho stateful agents với memory nhiều tầng.",
    tags: ["mcp", "stateful-agent", "memory"],
  },
  {
    id: "plugin-mem0",
    name: "Mem0",
    repo: "https://github.com/mem0ai/mem0",
    description: "Nền tảng memory cho trợ lý AI cá nhân hóa theo người dùng.",
    tags: ["plugin", "memory", "personalization"],
  },
  {
    id: "plugin-zep",
    name: "Zep",
    repo: "https://github.com/getzep/zep",
    description: "Memory API cho hội thoại dài với search và session profile.",
    tags: ["plugin", "conversation-memory", "api"],
  },
  {
    id: "plugin-letta",
    name: "Letta",
    repo: "https://github.com/letta-ai/letta",
    description: "Framework agent stateful có kiến trúc memory-first.",
    tags: ["plugin", "agent-framework", "memory"],
  },
  {
    id: "plugin-langmem",
    name: "LangMem",
    repo: "https://github.com/langchain-ai/langmem",
    description: "Toolkit memory extraction/recall cho ứng dụng LLM production.",
    tags: ["plugin", "langchain", "memory"],
  },
  {
    id: "plugin-grazie-memory",
    name: "Memary",
    repo: "https://github.com/kingjulio8238/memary",
    description: "Bộ nhớ semantic mã nguồn mở để cải thiện context cho AI app.",
    tags: ["plugin", "semantic-memory", "open-source"],
  },
  {
    id: "skill-agent-memory-mcp",
    name: "Agent Memory MCP Skill",
    repo: "https://github.com/agent-memory/mcp-server",
    description: "Mẫu triển khai hybrid memory và recall patterns cho agent.",
    tags: ["skill", "memory", "hybrid"],
  },
  {
    id: "skill-agent-memory-systems",
    name: "Agent Memory Systems Skill",
    repo: "https://github.com/sickn33/antigravity-awesome-skills",
    description: "Bộ skill thiết kế short-term, long-term và episodic memory.",
    tags: ["skill", "agent", "memory-design"],
  },
  {
    id: "skill-langmem",
    name: "LangMem Patterns",
    repo: "https://github.com/langchain-ai/langmem",
    description: "Pattern set cho memory extraction, consolidation và retrieval.",
    tags: ["skill", "langmem", "memory-pattern"],
  },
  {
    id: "skill-mem0-guides",
    name: "Mem0 Guides",
    repo: "https://github.com/mem0ai/mem0",
    description: "Thực hành tích hợp memory theo user, thread, và team context.",
    tags: ["skill", "mem0", "guides"],
  },
  {
    id: "skill-letta-recipes",
    name: "Letta Recipes",
    repo: "https://github.com/letta-ai/letta",
    description: "Recipe cho stateful-agent memory loop và tool + memory planning.",
    tags: ["skill", "letta", "stateful"],
  },
  {
    id: "rules-memory-rag",
    name: "RAG Security Rules",
    repo: "https://github.com/protectai/rebom",
    description: "Quy tắc an toàn và governance khi dùng memory + retrieval cho AI.",
    tags: ["rules", "security", "governance"],
  },
  {
    id: "rules-prompt-injection",
    name: "Prompt Injection Defenses",
    repo: "https://github.com/tldrsec/prompt-injection-defenses",
    description: "Rulebook bảo vệ memory context trước prompt injection.",
    tags: ["rules", "prompt-injection", "memory-safety"],
  },
  {
    id: "token-saver-minference",
    name: "MInference",
    repo: "https://github.com/microsoft/MInference",
    description: "Giảm chi phí context dài khi dùng memory history rất lớn.",
    tags: ["token", "long-context", "efficiency"],
  },
  {
    id: "token-saver-llmlingua",
    name: "LLMLingua",
    repo: "https://github.com/microsoft/LLMLingua",
    description: "Nén prompt/context để tiết kiệm token khi kết hợp memory.",
    tags: ["token", "compression", "memory"],
  },
];

function resolveRepoAvatar(repo) {
  try {
    const url = new URL(repo);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `https://github.com/${parts[0]}.png?size=64`;
    }
  } catch {
  }
  return "";
}

function RepoCard({ item }) {
  const avatar = resolveRepoAvatar(item.repo);

  return (
    <a
      href={item.repo}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "rounded-xl border border-black/10 dark:border-white/10 p-4",
        "hover:border-primary/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            {avatar ? (
              <img
                src={avatar}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  const fallback = event.currentTarget.nextElementSibling;
                  if (fallback) fallback.classList.remove("hidden");
                }}
              />
            ) : null}
            <span className={cn("material-symbols-outlined flex h-full w-full items-center justify-center text-[20px] text-text-muted", avatar ? "hidden" : "")}>memory</span>
          </div>

          <div className="min-w-0">
            <p className="text-base font-semibold text-text-main">{item.name}</p>
            <p className="mt-1 text-sm text-text-muted">{item.description}</p>
            <p className="mt-3 text-xs text-primary break-all">{item.repo}</p>
          </div>
        </div>

        <span className="material-symbols-outlined text-text-muted">open_in_new</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span key={`${item.id}:${tag}`} className="rounded-md bg-black/5 dark:bg-white/5 px-2 py-1 text-[11px] text-text-muted">
            #{tag}
          </span>
        ))}
      </div>
    </a>
  );
}

export default function AIMemoryPageClient() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return MEMORY_REPOS;
    return MEMORY_REPOS.filter((item) => {
      const text = `${item.name} ${item.description} ${item.tags.join(" ")} ${item.repo}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Memory</h1>
        <p className="mt-1 text-text-muted">Danh sách toàn bộ repo memory trong Power Up.</p>
      </div>

      <Card className="p-4">
        <Input
          label="Search memory repos"
          placeholder="Tìm theo tên, tag, mô tả hoặc URL repo"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="mt-2 text-xs text-text-muted">{filtered.length}/{MEMORY_REPOS.length} repositories</p>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-main">Memory</h2>
          <span className="text-xs text-text-muted">{filtered.length} repos</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-6 text-sm text-text-muted dark:border-white/10">
            Không có repository phù hợp với từ khóa.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => (
              <RepoCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
