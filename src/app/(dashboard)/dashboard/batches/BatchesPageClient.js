"use client";

import { useCallback, useEffect, useState } from "react";

export default function BatchesPageClient() {
  const [apiKey, setApiKey] = useState("");
  const [batches, setBatches] = useState([]);
  const [inputFileId, setInputFileId] = useState("");
  const [endpoint, setEndpoint] = useState("/v1/chat/completions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/keys", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const k = (d.keys || []).find((x) => x.isActive !== false)?.key;
        if (k) setApiKey(k);
      })
      .catch(() => {});
  }, []);

  const headers = useCallback(() => {
    const h = { "Content-Type": "application/json" };
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
    return h;
  }, [apiKey]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/v1/batches", { headers: headers(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setBatches(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, [headers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async () => {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/v1/batches", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          input_file_id: inputFileId,
          endpoint,
          completion_window: "24h",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setStatus(`Created batch ${data.id || ""}`);
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold">Batches</h1>
        <p className="text-sm text-text-muted mt-1">
          OpenAI-compatible batch API — POST/GET /v1/batches. Cần file input (upload /v1/files trước).
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
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
            <span className="text-xs text-text-muted">Endpoint</span>
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              <option value="/v1/chat/completions">/v1/chat/completions</option>
              <option value="/v1/embeddings">/v1/embeddings</option>
              <option value="/v1/completions">/v1/completions</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-text-muted">input_file_id</span>
            <input
              value={inputFileId}
              onChange={(e) => setInputFileId(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm font-mono"
              placeholder="file-…"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || !inputFileId}
            onClick={create}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "…" : "Create batch"}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>
        {status && <p className="text-sm text-primary">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold mb-3">Batches</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-text-muted">Chưa có batch.</p>
        ) : (
          <pre className="text-xs font-mono overflow-auto max-h-96 bg-black/10 p-3 rounded-lg">
            {JSON.stringify(batches, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
