"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const REPOS = [
  { name: "RTK (Rust Token Killer)", url: "https://github.com/rtk-ai/rtk", note: "Giảm token output terminal/log/build/test." },
  { name: "Context Mode", url: "https://github.com/mksglu/context-mode", note: "Đẩy output tool vào SQLite, chỉ đọc bản tóm tắt." },
  { name: "code-review-graph", url: "https://github.com/tirth8205/code-review-graph", note: "Knowledge graph local cho codebase lớn/monorepo." },
  { name: "Token Savior", url: "https://github.com/Mibayy/token-savior", note: "Đi theo symbol thay vì mở full file." },
  { name: "Caveman Claude", url: "https://github.com/JuliusBrussee/caveman-claude", note: "Rút gọn output text nhưng vẫn giữ ý chính." },
  { name: "claude-token-efficient", url: "https://github.com/drona23/claude-token-efficient", note: "Drop-in prompt/CLAUDE.md để phản hồi ngắn gọn." },
  { name: "token-optimizer-mcp", url: "https://github.com/ooples/token-optimizer-mcp", note: "MCP có caching + nén + giảm lặp output." },
  { name: "claude-token-optimizer", url: "https://github.com/nadimtuhin/claude-token-optimizer", note: "Bộ setup/prompt tái sử dụng để tối ưu token." },
  { name: "token-optimizer", url: "https://github.com/alexgreensh/token-optimizer", note: "Giảm ghost tokens và giữ chất lượng context." },
  { name: "claude-context (Zilliz)", url: "https://github.com/zilliztech/claude-context", note: "Code search + retrieval thông minh để giảm context." },
];

const SAMPLE_TEXT = `npm test

FAIL tests/example.test.ts
  ● Example test suite › should work

    expect(received).toBe(expected)

    Expected: true
    Received: false

      12 |   it('should work', () => {
      13 |     const result = doSomething();
    > 14 |     expect(result).toBe(true);
         |                    ^
      15 |   });

      at Object.<anonymous> (tests/example.test.ts:14:20)

progress...
progress...
progress...
progress...
progress...
progress...
progress...
progress...
progress...
progress...

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Time:        2.456 s`;

function getOwnerAvatar(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    if (!owner) return "/topup.png";
    return `https://github.com/${owner}.png`;
  } catch {
    return "/topup.png";
  }
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0%";
  return `${value.toFixed(2)}%`;
}

export default function TokenSaverPageClient() {
  const [mode, setMode] = useState("rtk");
  const [intensity, setIntensity] = useState("full");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [headroom, setHeadroom] = useState(null);

  useEffect(() => {
    fetch("/api/headroom/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHeadroom)
      .catch(() => setHeadroom({ available: false, error: "unreachable" }));
  }, []);

  const stats = result?.stats;
  const estimatedTokens = useMemo(() => {
    const original = Math.ceil((stats?.originalLength || text.length) / 4);
    const compressed = Math.ceil((stats?.compressedLength || text.length) / 4);
    return { original, compressed, saved: Math.max(0, original - compressed) };
  }, [stats, text.length]);

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, intensity, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Compression failed");
      setResult(data);
    } catch (err) {
      setError(err.message || "Compression failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">Token Saver</h1>
        <p className="text-sm text-text-muted">Preview RTK, Caveman và stacked compression trước khi bật trong Endpoint.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/10 p-4 md:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-main">Headroom status</h2>
            <p className="text-sm text-text-muted">
              Proxy nén context ngoài (mặc định localhost:8787). Chi tiết điều khiển:{" "}
              <Link href="/dashboard/ops" className="text-primary underline">Ops</Link>.
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              headroom?.available
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-white/10 text-text-muted"
            }`}
          >
            {headroom == null ? "…" : headroom.available ? "Available" : "Offline"}
          </span>
        </div>
        {headroom && (
          <pre className="text-xs font-mono rounded-lg bg-black/20 p-3 overflow-auto max-h-32">
            {JSON.stringify(headroom, null, 2)}
          </pre>
        )}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-main">Compression Preview</h2>
            <p className="text-sm text-text-muted">RTK tối ưu log/tool output, Caveman rút gọn prose, Stacked chạy RTK rồi Caveman.</p>
          </div>
          <Link href="/dashboard/endpoint" className="inline-flex items-center justify-center rounded-lg border border-primary/30 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors">
            Mở Endpoint settings
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text-main outline-none focus:border-primary">
              <option value="rtk">RTK</option>
              <option value="caveman">Caveman</option>
              <option value="stacked">Stacked</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Caveman intensity</span>
            <select value={intensity} onChange={(event) => setIntensity(event.target.value)} disabled={mode === "rtk"} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text-main outline-none focus:border-primary disabled:opacity-50">
              <option value="lite">Lite</option>
              <option value="full">Full</option>
              <option value="ultra">Ultra</option>
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={handlePreview} disabled={loading || !text.trim()} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading ? "Đang nén..." : "Preview compression"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-text-main">Input</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={16} className="w-full rounded-xl border border-border bg-input p-3 font-mono text-xs text-text-main outline-none focus:border-primary" />
          </label>
          <div className="space-y-2">
            <span className="text-sm font-medium text-text-main">Output</span>
            <pre className="min-h-[384px] whitespace-pre-wrap rounded-xl border border-border bg-black/20 p-3 font-mono text-xs text-text-main overflow-auto">
              {result?.compressed || "Chưa có preview. Nhấn Preview compression để test."}
            </pre>
          </div>
        </div>

        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-text-muted">Original</p>
            <p className="text-lg font-semibold text-text-main">{stats?.originalLength || text.length} chars</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-text-muted">Compressed</p>
            <p className="text-lg font-semibold text-text-main">{stats?.compressedLength || "-"} chars</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-text-muted">Savings</p>
            <p className="text-lg font-semibold text-primary">{formatPercent(stats?.ratio || 0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-text-muted">Est. tokens saved</p>
            <p className="text-lg font-semibold text-text-main">{estimatedTokens.saved}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/10 p-4 md:p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Reference repos</h2>
          <p className="text-sm text-text-muted">Nguồn tham khảo cho các chiến lược tiết kiệm token.</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {REPOS.map((repo) => (
            <div key={repo.url} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:border-primary/40 transition-colors flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <img src={getOwnerAvatar(repo.url)} alt={`${repo.name} owner avatar`} className="size-9 shrink-0 rounded-lg bg-white object-cover" loading="lazy" />
                <div className="min-w-0">
                  <a href={repo.url} target="_blank" rel="noopener noreferrer" className="font-medium text-text-main hover:text-primary transition-colors truncate block">
                    {repo.name}
                  </a>
                  <p className="text-sm text-text-muted mt-1 truncate">{repo.note}</p>
                </div>
              </div>
              <a href={repo.url} target="_blank" rel="noopener noreferrer" className="size-9 shrink-0 rounded-full border border-white/15 hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center justify-center" title="Mở repo">
                <span className="material-symbols-outlined text-[22px]">open_in_new</span>
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
