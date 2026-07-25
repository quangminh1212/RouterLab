"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TABS = [
  { id: "ocr", label: "OCR", icon: "document_scanner", hint: "POST /v1/ocr" },
  { id: "translate", label: "Dịch audio", icon: "translate", hint: "POST /v1/audio/translations" },
  { id: "music", label: "Nhạc", icon: "music_note", hint: "POST /v1/audio/music" },
  { id: "video", label: "Video", icon: "movie", hint: "POST /v1/videos/generations" },
  { id: "endpoints", label: "Endpoint map", icon: "api", hint: "Danh sách API" },
];

const ENDPOINT_MAP = [
  { group: "Chat / LLM", items: [
    "POST /v1/chat/completions", "POST /v1/messages", "POST /v1/responses", "POST /v1/completions",
    "GET /v1/models", "POST /backend-api/codex/responses",
  ]},
  { group: "Media", items: [
    "POST /v1/images/generations", "POST /v1/images/edits", "POST /v1/ocr",
    "POST /v1/audio/speech", "POST /v1/audio/transcriptions", "POST /v1/audio/translations",
    "POST /v1/audio/music", "POST /v1/video/generations", "POST /v1/videos/generations",
  ]},
  { group: "Tools", items: [
    "POST /v1/embeddings", "POST /v1/rerank", "POST /v1/moderations",
    "POST /v1/search", "POST /v1/web/fetch", "POST /v1/agents/tasks",
  ]},
];

function TabButton({ tab, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab.id)}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-black/5 dark:bg-white/5 text-text-main hover:bg-primary/10"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
      {tab.label}
    </button>
  );
}

export default function PlaygroundPageClient() {
  const [tab, setTab] = useState("ocr");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("mistral-ocr-latest");
  const [prompt, setPrompt] = useState("A calm lo-fi beat");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentB64, setDocumentB64] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/keys", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const key = (d.keys || []).find((k) => k.isActive !== false)?.key;
        if (key) setApiKey(key);
      })
      .catch(() => {});
  }, []);

  const authHeaders = () => {
    const h = {};
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
    return h;
  };

  const runOcr = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const document = documentB64
        ? { type: "document_url", document_url: `data:application/pdf;base64,${documentB64}` }
        : documentUrl
          ? { type: "document_url", document_url: documentUrl }
          : null;
      if (!document) throw new Error("Cần URL tài liệu hoặc file base64");
      const res = await fetch("/api/v1/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ model, document }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const runTranslate = async () => {
    if (!audioFile) {
      setError("Chọn file audio");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", audioFile);
      fd.append("model", model || "whisper-1");
      const res = await fetch("/api/v1/audio/translations", {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("json") ? await res.json() : { text: await res.text() };
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const runMusic = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/v1/audio/music", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          model: model || "suno",
          prompt,
          wait_for_completion: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const runVideo = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/v1/videos/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          model: model || "video",
          prompt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const onFileB64 = async (file) => {
    if (!file) return;
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(file);
    });
    setDocumentB64(b64);
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">Playground</h1>
        <p className="text-sm text-text-muted">
          Thử OCR, dịch audio, nhạc, video và xem map endpoint — các tính năng API đã tích hợp.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <TabButton key={t.id} tab={t} active={tab === t.id} onClick={setTab} />
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">API Key (RouterLab)</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
              placeholder="Bearer key (tự load từ /api/keys nếu có)"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Model</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
              placeholder="mistral-ocr-latest | whisper-1 | suno | …"
            />
          </label>
        </div>

        {tab === "ocr" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">POST /v1/ocr — Mistral OCR format. Cần credential provider mistral.</p>
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-text-muted">Document URL</span>
              <input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                placeholder="https://…/file.pdf"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-medium text-text-muted">Hoặc upload file (base64)</span>
              <input type="file" accept=".pdf,image/*" onChange={(e) => onFileB64(e.target.files?.[0])} className="text-sm" />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={runOcr}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Đang chạy…" : "Chạy OCR"}
            </button>
          </div>
        )}

        {tab === "translate" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">POST /v1/audio/translations — Whisper translate → English.</p>
            <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="text-sm" />
            <button
              type="button"
              disabled={loading}
              onClick={runTranslate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Đang dịch…" : "Dịch audio → EN"}
            </button>
          </div>
        )}

        {tab === "music" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              POST /v1/audio/music — suno/udio (cookie). Cấu hình provider tại{" "}
              <Link href="/dashboard/media-providers/music" className="text-primary underline">Media → Nhạc</Link>.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-input p-3 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={runMusic}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Đang tạo…" : "Tạo nhạc"}
            </button>
          </div>
        )}

        {tab === "video" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              POST /v1/videos/generations —{" "}
              <Link href="/dashboard/media-providers/video" className="text-primary underline">Media → Video</Link>.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-input p-3 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={runVideo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Đang tạo…" : "Tạo video"}
            </button>
          </div>
        )}

        {tab === "endpoints" && (
          <div className="space-y-4">
            {ENDPOINT_MAP.map((g) => (
              <div key={g.group}>
                <h3 className="text-sm font-semibold text-text-main mb-2">{g.group}</h3>
                <ul className="space-y-1">
                  {g.items.map((ep) => (
                    <li key={ep} className="font-mono text-xs text-text-muted rounded-md bg-black/5 dark:bg-white/5 px-2 py-1">
                      {ep}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-text-muted">
              Chi tiết quản lý API key / tunnel:{" "}
              <Link href="/dashboard/endpoint" className="text-primary underline">Điểm cuối</Link>
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        {result && (
          <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-black/20 p-3 font-mono text-xs text-text-main">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
