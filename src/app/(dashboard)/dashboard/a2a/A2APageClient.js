"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function A2APageClient() {
  const [status, setStatus] = useState(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    Promise.all([
      fetch("/api/a2a/status", { cache: "no-store" })
        .then((r) => r.json())
        .catch((e) => ({ error: e.message })),
      fetch("/.well-known/agent.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([st, c]) => {
      setStatus(st);
      setCard(c);
      if (st?.error) setError(st.error);
    });
  }, []);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <header>
        <h1 className="text-3xl font-semibold">A2A Agents</h1>
        <p className="text-sm text-text-muted mt-1">
          Agent-to-Agent surface: agent card + task API. Endpoints:{" "}
          <code className="text-xs">/.well-known/agent.json</code>,{" "}
          <code className="text-xs">/a2a</code>, <code className="text-xs">/api/a2a/*</code>
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <h2 className="text-lg font-semibold">Status</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <pre className="text-xs font-mono bg-black/10 p-3 rounded-lg overflow-auto">
          {JSON.stringify(status || { loading: true }, null, 2)}
        </pre>
        <div className="flex flex-wrap gap-3 text-sm">
          <a className="text-primary underline" href={`${origin}/.well-known/agent.json`} target="_blank" rel="noreferrer">
            Open agent card
          </a>
          <a className="text-primary underline" href={`${origin}/a2a`} target="_blank" rel="noreferrer">
            /a2a
          </a>
          <Link className="text-primary underline" href="/dashboard/cloud-agents">
            Cloud Agents (Jules/Devin)
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <h2 className="text-lg font-semibold">Agent card preview</h2>
        <pre className="text-xs font-mono bg-black/10 p-3 rounded-lg overflow-auto max-h-96">
          {card ? JSON.stringify(card, null, 2) : "—"}
        </pre>
      </section>
    </div>
  );
}
