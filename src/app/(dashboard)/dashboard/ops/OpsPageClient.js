"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-text-main">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function OpsPageClient() {
  const [headroom, setHeadroom] = useState(null);
  const [redis, setRedis] = useState(null);
  const [payloadRules, setPayloadRules] = useState([]);
  const [ruleDraft, setRuleDraft] = useState(
    '{\n  "name": "strip-temperature",\n  "enabled": true,\n  "actions": [{ "op": "delete", "path": "temperature" }]\n}'
  );
  const [selfHeal, setSelfHeal] = useState(null);
  const [credMode, setCredMode] = useState("file");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [h, r, p] = await Promise.all([
        fetch("/api/headroom/status", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/management/redis-usage-queue", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/settings/payload-rules", { cache: "no-store" }).then((x) => x.json()),
      ]);
      setHeadroom(h);
      setRedis(r);
      setPayloadRules(Array.isArray(p?.rules) ? p.rules : []);
    } catch (e) {
      setErr(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startRedis = async () => {
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/management/redis-usage-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: 6379 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Start redis queue failed");
      setRedis(data);
      setMsg("Redis usage queue started (in-process RESP)");
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  const runSelfHeal = async (dryRun) => {
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/management/combo-self-heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, minSamples: 6 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Self-heal failed");
      setSelfHeal(data);
      setMsg(dryRun ? "Self-heal dry-run xong" : "Self-heal đã áp dụng");
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  const saveRule = async () => {
    setMsg("");
    setErr("");
    try {
      const parsed = JSON.parse(ruleDraft);
      const next = [...payloadRules, parsed];
      const res = await fetch("/api/settings/payload-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setPayloadRules(Array.isArray(data.rules) ? data.rules : next);
      setMsg("Đã lưu payload rules");
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  const clearRules = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/settings/payload-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Clear failed");
      setPayloadRules([]);
      setMsg("Đã xóa hết payload rules");
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">Vận hành / Ops</h1>
        <p className="text-sm text-text-muted">
          Headroom, Redis usage queue, combo self-heal, payload rules, credential store — UI cho API đã tích hợp.
        </p>
      </header>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      {err && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>
      )}

      <Section
        title="Headroom (nén context)"
        action={
          <button type="button" onClick={load} className="text-sm text-primary hover:underline">
            Refresh
          </button>
        }
      >
        <pre className="text-xs font-mono bg-black/10 rounded-lg p-3 overflow-auto">
          {JSON.stringify(headroom || { loading: true }, null, 2)}
        </pre>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/dashboard/token-saver" className="text-primary underline">
            Token Saver preview
          </Link>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">
            API: /api/headroom/status · start/stop là external process
          </span>
        </div>
      </Section>

      <Section title="Redis usage queue (CLIProxyAPI)">
        <pre className="text-xs font-mono bg-black/10 rounded-lg p-3 overflow-auto">
          {JSON.stringify(redis || { loading: true }, null, 2)}
        </pre>
        <button
          type="button"
          onClick={startRedis}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Start queue (port 6379)
        </button>
        <p className="text-xs text-text-muted">
          Production nên set env REDIS_USAGE_QUEUE_PORT rồi restart service.
        </p>
      </Section>

      <Section title="Combo self-heal (OmniRoute)">
        <p className="text-sm text-text-muted">
          Tối ưu thứ tự model trong combo theo latency/failure. Mặc định dry-run an toàn.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runSelfHeal(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:border-primary/40"
          >
            Dry-run
          </button>
          <button
            type="button"
            onClick={() => runSelfHeal(false)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
          <Link href="/dashboard/combos" className="rounded-lg border border-border px-4 py-2 text-sm">
            Mở Combos
          </Link>
        </div>
        {selfHeal && (
          <pre className="text-xs font-mono bg-black/10 rounded-lg p-3 overflow-auto max-h-64">
            {JSON.stringify(selfHeal, null, 2)}
          </pre>
        )}
      </Section>

      <Section title="Payload rules (CLIProxyAPI)">
        <p className="text-sm text-text-muted">
          Sửa body request (set/default/delete/rename) trước khi gửi upstream. Hiện có{" "}
          <strong>{payloadRules.length}</strong> rule.
        </p>
        <textarea
          value={ruleDraft}
          onChange={(e) => setRuleDraft(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-border bg-input p-3 font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveRule}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Thêm rule
          </button>
          <button
            type="button"
            onClick={clearRules}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Xóa tất cả
          </button>
        </div>
        {payloadRules.length > 0 && (
          <pre className="text-xs font-mono bg-black/10 rounded-lg p-3 overflow-auto max-h-48">
            {JSON.stringify(payloadRules, null, 2)}
          </pre>
        )}
      </Section>

      <Section title="Credential store">
        <p className="text-sm text-text-muted">
          Chế độ backend credential (env <code className="text-xs">CREDENTIAL_STORE</code>): file
          (mặc định) · postgres · git · s3. UI chỉ hiển thị hướng dẫn — đổi qua env + restart.
        </p>
        <select
          value={credMode}
          onChange={(e) => setCredMode(e.target.value)}
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
        >
          <option value="file">file (localDb)</option>
          <option value="postgres">postgres (DATABASE_URL + pg)</option>
          <option value="git">git (CREDENTIAL_GIT_DIR)</option>
          <option value="s3">s3 (S3_BUCKET + AWS SDK)</option>
        </select>
        <pre className="text-xs font-mono bg-black/10 rounded-lg p-3">
          {`CREDENTIAL_STORE=${credMode}
# postgres: DATABASE_URL=postgres://...
# git:      CREDENTIAL_GIT_DIR=/path
# s3:       S3_BUCKET=... AWS_REGION=...`}
        </pre>
      </Section>
    </div>
  );
}
