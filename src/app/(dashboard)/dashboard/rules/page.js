"use client";

import { useEffect, useMemo, useState } from "react";

function createEmptyRule() {
  return {
    id: `rule-${Date.now()}`,
    name: "",
    enabled: true,
    content: "",
    priority: "medium",
    applyType: "always",
    updatedAt: new Date().toISOString(),
  };
}

function priorityRank(value) {
  if (value === "high") return 1;
  if (value === "low") return 3;
  return 2;
}

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(createEmptyRule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [openSettingsId, setOpenSettingsId] = useState("");

  const sortedRules = useMemo(() => [...rules].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)), [rules]);
  const enabledCount = useMemo(() => sortedRules.filter((r) => r.enabled).length, [sortedRules]);

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
      setRules(Array.isArray(data?.rules) ? data.rules : []);
      setStatus("Đã lưu rule AI");
    } catch (error) {
      setStatus(error.message || "Lưu rule thất bại");
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    if (!draft.content.trim()) {
      setStatus("Cần nhập nội dung rule");
      return;
    }
    const nextRules = [...rules, { ...draft, id: `rule-${Date.now()}`, name: draft.name.trim() || `Rule ${rules.length + 1}` }];
    await saveRules(nextRules);
    setDraft(createEmptyRule());
    setShowAddForm(false);
  };

  const removeRule = async (id) => {
    await saveRules(rules.filter((item) => item.id !== id));
    if (openSettingsId === id) setOpenSettingsId("");
  };

  const toggleRule = async (id) => {
    const nextRules = rules.map((item) => (item.id === id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item));
    await saveRules(nextRules);
  };

  const updateRule = async (id, patch) => {
    const nextRules = rules.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    await saveRules(nextRules);
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-main">Rules</h1>
          <p className="mt-1 text-sm text-text-muted">Quản lý bộ rule AI gọn gàng, rõ ràng, dễ vận hành.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5">Total: {sortedRules.length}</span>
          <span className="px-2.5 py-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">Enabled: {enabledCount}</span>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/10 backdrop-blur-sm p-4 md:p-5 space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="size-7 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
              title={showAddForm ? "Đóng" : "Thêm rule"}
            >
              +
            </button>
            <span className="material-symbols-outlined text-primary">rule_settings</span>
            <h2 className="text-base font-semibold text-text-main">Danh sách Rule ({sortedRules.length})</h2>
          </div>
        </div>

        {showAddForm && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="md:col-span-2 w-full px-3 py-2.5 rounded-xl bg-sidebar border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Tên rule (tuỳ chọn)" value={draft?.name ?? ""} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} />
              <select className="w-full px-3 py-2.5 rounded-xl bg-sidebar border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" value={draft?.priority ?? "medium"} onChange={(e) => setDraft((v) => ({ ...v, priority: e.target.value }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <select className="w-full px-3 py-2.5 rounded-xl bg-sidebar border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" value={draft?.applyType ?? "always"} onChange={(e) => setDraft((v) => ({ ...v, applyType: e.target.value }))}>
              <option value="always">Always</option>
              <option value="contains">Contains text</option>
            </select>

            <textarea className="w-full min-h-36 px-3 py-2.5 rounded-xl bg-sidebar border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="# Rule
Viết nội dung markdown tại đây..." value={draft?.content ?? ""} onChange={(e) => setDraft((v) => ({ ...v, content: e.target.value }))} />

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => { setShowAddForm(false); setDraft(createEmptyRule()); }} className="px-4 py-2 rounded-lg border border-white/10 text-text-muted hover:text-text-main hover:bg-white/5 transition-colors">Huỷ</button>
              <button onClick={addRule} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-60 hover:bg-primary/90 transition-colors">
                {saving ? "Đang lưu..." : "Lưu rule mới"}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-text-muted">Đang tải...</p>}
        {!loading && sortedRules.length === 0 && <p className="text-sm text-text-muted">Chưa có rule nào.</p>}

        {!loading && sortedRules.map((rule) => {
          const isOpen = openSettingsId === rule.id;
          return (
            <article key={rule.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-text-main truncate">{rule.name || "Untitled rule"}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {rule.enabled ? "Active" : "Disabled"} · {String(rule.priority || "medium").toUpperCase()}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setOpenSettingsId(isOpen ? "" : rule.id)}
                    className="px-2.5 py-1.5 rounded-md text-xs border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    {isOpen ? "Close" : "Settings"}
                  </button>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    disabled={saving}
                    className="px-2.5 py-1.5 rounded-md text-xs border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => removeRule(rule.id)}
                    disabled={saving}
                    className="px-2.5 py-1.5 rounded-md text-xs bg-red-500/90 hover:bg-red-500 text-white transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-wide text-text-muted">Rule name</span>
                      <input className="w-full px-3 py-2 rounded-lg bg-sidebar/80 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" defaultValue={rule.name || ""} onBlur={(e) => updateRule(rule.id, { name: e.target.value.trim() || rule.name })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-wide text-text-muted">Priority</span>
                      <select className="w-full px-3 py-2 rounded-lg bg-sidebar/80 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" defaultValue={rule.priority || "medium"} onBlur={(e) => updateRule(rule.id, { priority: e.target.value })}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-wide text-text-muted">Apply rule</span>
                      <select className="w-full px-3 py-2 rounded-lg bg-sidebar/80 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" defaultValue={rule.applyType || "always"} onBlur={(e) => updateRule(rule.id, { applyType: e.target.value })}>
                        <option value="always">Always</option>
                        <option value="contains">Contains text</option>
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] uppercase tracking-wide text-text-muted">Markdown content</span>
                    <textarea className="w-full min-h-28 px-3 py-2 rounded-lg bg-sidebar/80 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40" defaultValue={rule.content || ""} onBlur={(e) => updateRule(rule.id, { content: e.target.value })} />
                  </label>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {status && <p className="text-sm text-text-muted">{status}</p>}
    </div>
  );
}

