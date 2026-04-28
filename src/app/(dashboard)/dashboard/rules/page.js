"use client";

import { useEffect, useMemo, useState } from "react";

function createEmptyRule() {
  return {
    id: `rule-${Date.now()}`,
    name: "",
    enabled: true,
    content: "",
    updatedAt: new Date().toISOString(),
  };
}

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(createEmptyRule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const sortedRules = useMemo(() => [...rules], [rules]);

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
    if (!draft.content.trim()) {
      setStatus("Cần nhập nội dung rule");
      return;
    }
    const nextRules = [...rules, { ...draft, id: `rule-${Date.now()}`, name: draft.name.trim() || `Rule ${rules.length + 1}` }];
    await saveRules(nextRules);
    setDraft(createEmptyRule());
  };

  const updateRuleContent = async (id, content) => {
    const nextRules = rules.map((item) => (
      item.id === id ? { ...item, content, updatedAt: new Date().toISOString() } : item
    ));
    await saveRules(nextRules);
  };

  const updateRuleName = async (id, name) => {
    const nextRules = rules.map((item) => (
      item.id === id ? { ...item, name: name || item.name, updatedAt: new Date().toISOString() } : item
    ));
    await saveRules(nextRules);
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
        <p className="text-sm text-text-muted">Nhập rule như file markdown. Có thể thêm nhiều rule.</p>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <h2 className="text-base font-semibold text-text-main">Thêm Rule</h2>
        <input className="w-full px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" placeholder="Tên rule (tuỳ chọn)" value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} />
        <textarea className="w-full min-h-32 px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10" placeholder="# Rule\nViết nội dung markdown tại đây..." value={draft.content} onChange={(e) => setDraft((v) => ({ ...v, content: e.target.value }))} />
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
            <div className="space-y-2 flex-1">
              <input
                className="w-full px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                defaultValue={rule.name || ""}
                onBlur={(e) => updateRuleName(rule.id, e.target.value.trim())}
              />
              <textarea
                className="w-full min-h-28 px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                defaultValue={rule.content || ""}
                onBlur={(e) => updateRuleContent(rule.id, e.target.value)}
              />
              <p className="text-xs text-text-muted">Cập nhật: {rule.updatedAt || "-"}</p>
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
