"use client";

import { useEffect, useMemo, useState } from "react";

function createEmptyRule() {
  return {
    id: `rule-${Date.now()}`,
    name: "",
    enabled: true,
    trigger: "contains",
    matchText: "",
    target: "all",
    actionType: "prepend-system",
    actionValue: "",
    priority: 100,
  };
}

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(createEmptyRule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const sortedRules = useMemo(() => [...rules].sort((a, b) => (a.priority || 100) - (b.priority || 100)), [rules]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/ai-rules", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Không tải được rule");
        if (!cancelled) setRules(Array.isArray(data?.rules) ? data.rules : []);
      } catch (error) {
        if (!cancelled) setStatus(error.message || "Không tải được rule");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveRules = async (nextRules) => {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/settings/ai-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: nextRules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Lưu rule thất bại");
      const savedRules = Array.isArray(data?.rules) ? data.rules : [];
      setRules(savedRules);
      setStatus("Đã lưu rule AI");
    } catch (error) {
      setStatus(error.message || "Lưu rule thất bại");
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    if (!draft.name.trim() || !draft.matchText.trim() || !draft.actionValue.trim()) {
      setStatus("Cần nhập tên, điều kiện và nội dung action");
      return;
    }
    const nextRules = [...rules, { ...draft, id: `rule-${Date.now()}` }];
    await saveRules(nextRules);
    setDraft(createEmptyRule());
  };

  const removeRule = async (id) => {
    const nextRules = rules.filter((item) => item.id !== id);
    await saveRules(nextRules);
  };

  const toggleRule = async (id) => {
    const nextRules = rules.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item));
    await saveRules(nextRules);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-main">Rules</h1>
        <p className="text-sm text-text-muted">Thêm rule AI để áp dụng prompt/action theo điều kiện.</p>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <h2 className="text-base font-semibold text-text-main">Thêm Rule AI</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" placeholder="Tên rule" value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} />
          <input className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" placeholder="Điều kiện (match text)" value={draft.matchText} onChange={(e) => setDraft((v) => ({ ...v, matchText: e.target.value }))} />
          <select className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" value={draft.trigger} onChange={(e) => setDraft((v) => ({ ...v, trigger: e.target.value }))}>
            <option value="contains">contains</option>
            <option value="startsWith">startsWith</option>
            <option value="equals">equals</option>
            <option value="regex">regex</option>
          </select>
          <select className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" value={draft.target} onChange={(e) => setDraft((v) => ({ ...v, target: e.target.value }))}>
            <option value="all">all</option>
            <option value="system">system</option>
            <option value="user">user</option>
            <option value="assistant">assistant</option>
          </select>
          <select className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" value={draft.actionType} onChange={(e) => setDraft((v) => ({ ...v, actionType: e.target.value }))}>
            <option value="prepend-system">prepend-system</option>
            <option value="append-system">append-system</option>
            <option value="replace-user">replace-user</option>
          </select>
          <input type="number" className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" placeholder="Priority" value={draft.priority} onChange={(e) => setDraft((v) => ({ ...v, priority: Number(e.target.value || 100) }))} />
        </div>
        <textarea className="w-full min-h-28 px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" placeholder="Action value (prompt/rule text)" value={draft.actionValue} onChange={(e) => setDraft((v) => ({ ...v, actionValue: e.target.value }))} />
        <button onClick={addRule} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-60">
          {saving ? "Đang lưu..." : "Thêm rule"}
        </button>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <h2 className="text-base font-semibold text-text-main">Danh sách Rule ({sortedRules.length})</h2>
        {loading && <p className="text-sm text-text-muted">Đang tải...</p>}
        {!loading && sortedRules.length === 0 && <p className="text-sm text-text-muted">Chưa có rule nào.</p>}
        {!loading && sortedRules.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium text-text-main">{rule.name} {rule.enabled ? "" : "(tắt)"}</p>
              <p className="text-xs text-text-muted">{rule.trigger} | target: {rule.target} | action: {rule.actionType} | priority: {rule.priority}</p>
              <p className="text-sm text-text-muted">match: {rule.matchText}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleRule(rule.id)} disabled={saving} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 text-sm">
                {rule.enabled ? "Disable" : "Enable"}
              </button>
              <button onClick={() => removeRule(rule.id)} disabled={saving} className="px-3 py-1 rounded bg-red-500/90 text-white text-sm">
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {status && <p className="text-sm text-text-muted">{status}</p>}
    </div>
  );
}

