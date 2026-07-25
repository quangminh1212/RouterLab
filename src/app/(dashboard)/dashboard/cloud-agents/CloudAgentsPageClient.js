"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const PROVIDERS = [
  { id: "jules", name: "Google Jules", hint: "provider jules + API key" },
  { id: "devin", name: "Devin", hint: "provider devin + token" },
  { id: "codex-cloud", name: "Codex Cloud", hint: "provider codex-cloud + OAuth/key" },
];

export default function CloudAgentsPageClient() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("jules");
  const [prompt, setPrompt] = useState("Review the README and suggest 3 improvements.");
  const [repoUrl, setRepoUrl] = useState("https://github.com/example/repo");
  const [branch, setBranch] = useState("main");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/keys", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const key = (d.keys || []).find((k) => k.isActive !== false)?.key;
        if (key) setApiKey(key);
      })
      .catch(() => {});
  }, []);

  const headers = useCallback(() => {
    const h = { "Content-Type": "application/json" };
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
    return h;
  }, [apiKey]);

  const refresh = useCallback(async () => {
    setListLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/agents/tasks?limit=30", {
        headers: headers(),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setTasks(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setListLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask = async () => {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/v1/agents/tasks", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          provider,
          prompt,
          repo_url: repoUrl,
          branch,
          auto_create_pr: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setStatus(`Đã tạo task ${data.id || data.providerTaskId || ""}`);
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">Cloud Agents</h1>
        <p className="text-sm text-text-muted">
          Tạo / theo dõi task Jules · Devin · Codex Cloud (POST/GET /v1/agents/tasks). Cần cấu hình provider tương ứng.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4 md:p-5 space-y-4">
        <h2 className="text-lg font-semibold">Tạo task</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-text-muted">API Key</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-text-muted">Repo URL</span>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Branch</span>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-text-muted">Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-input p-3 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={createTask}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Đang tạo…" : "Tạo cloud agent task"}
          </button>
          <Link
            href={`/dashboard/providers/${provider}`}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:border-primary/40"
          >
            Cấu hình provider
          </Link>
        </div>
        {status && <p className="text-sm text-primary">{status}</p>}
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Tasks gần đây</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={listLoading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/40 disabled:opacity-50"
          >
            {listLoading ? "…" : "Refresh"}
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted">Chưa có task. Tạo mới hoặc kiểm tra credential provider.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Repo</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id || t.providerTaskId} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs">{t.id || t.providerTaskId}</td>
                    <td className="py-2 pr-3">{t.provider}</td>
                    <td className="py-2 pr-3">{t.status || "—"}</td>
                    <td className="py-2 truncate max-w-[240px]">{t.repo_url || t.repoUrl || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
