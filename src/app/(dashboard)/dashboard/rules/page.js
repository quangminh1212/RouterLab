"use client";

import { useEffect, useMemo, useState } from "react";

function createEmptyRule() {
  return {
    id: `rule-${Date.now()}`,
    name: "",
    enabled: true,
    content: "",
    priority: 100,
    applyType: "always",
    applyValue: "",
    updatedAt: new Date().toISOString(),
  };
}

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(createEmptyRule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [openSettingsId, setOpenSettingsId] = useState("");

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => (a.priority || 100) - (b.priority || 100)),
    [rules]
  );

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
    const nextRules = [
      ...rules,
      {
        ...draft,
        id: `rule-${Date.now()}`,
        name: draft.name.trim() || `Rule ${rules.length + 1}`,
      },
    ];
    await saveRules(nextRules);
    setDraft(createEmptyRule());
    setShowAddForm(false);
  };

  const removeRule = async (id) => {
    await saveRules(rules.filter((item) => item.id !== id));
    if (openSettingsId === id) setOpenSettingsId("");
  };

  const toggleRule = async (id) => {
    const nextRules = rules.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item
    );
    await saveRules(nextRules);
  };

  const updateRule = async (id, patch) => {
    const nextRules = rules.map((item) =>
      item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
    );
    await saveRules(nextRules);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-main">Rules</h1>
        <p className="text-sm text-text-muted">Danh sách rule dạng gọn, bấm Settings để chỉnh chi tiết.</p>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-main">Thêm Rule</h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm"
          >
            {showAddForm ? "Đóng" : "Thêm rule"}
          </button>
        </div>

        {showAddForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="w-full px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10"
                placeholder="Tên rule (tuỳ chọn)"
                value={draft.name}
                onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
              />
              <input
                type="number"
                className="w-full px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10"
                placeholder="Priority"
                value={draft.priority}
                onChange={(e) => setDraft((v) => ({ ...v, priority: Number(e.target.value || 100) }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                className="px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10"
                value={draft.applyType}
                onChange={(e) => setDraft((v) => ({ ...v, applyType: e.target.value }))}
              >
                <option value="always">Always</option>
                <option value="contains">Contains text</option>
              </select>
              <input
                className="w-full px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10"
                placeholder="Apply value (dùng cho Contains text)"
                value={draft.applyValue}
                onChange={(e) => setDraft((v) => ({ ...v, applyValue: e.target.value }))}
              />
            </div>
            <textarea
              className="w-full min-h-32 px-3 py-2 rounded-lg bg-sidebar border border-black/10 dark:border-white/10"
              placeholder="# Rule
Viết nội dung markdown tại đây..."
              value={draft.content}
              onChange={(e) => setDraft((v) => ({ ...v, content: e.target.value }))}
            />
            <button
              onClick={addRule}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu rule mới"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
        <h2 className="text-base font-semibold text-text-main">Danh sách Rule ({sortedRules.length})</h2>
        {loading && <p className="text-sm text-text-muted">Đang tải...</p>}
        {!loading && sortedRules.length === 0 && <p className="text-sm text-text-muted">Chưa có rule nào.</p>}

        {!loading &&
          sortedRules.map((rule) => {
            const isOpen = openSettingsId === rule.id;
            return (
              <div key={rule.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-text-main truncate">
                      {rule.name || "Rule"} {rule.enabled ? "" : "(Tắt)"}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      Ưu tiên: {rule.priority ?? 100} | Áp dụng: {rule.applyType || "always"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOpenSettingsId(isOpen ? "" : rule.id)}
                      className="px-3 py-1 rounded border border-black/10 dark:border-white/10 text-sm"
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      disabled={saving}
                      className="px-3 py-1 rounded border border-black/10 dark:border-white/10 text-sm"
                    >
                      {rule.enabled ? "Tắt" : "Bật"}
                    </button>
                    <button
                      onClick={() => removeRule(rule.id)}
                      disabled={saving}
                      className="px-3 py-1 rounded bg-red-500/90 text-white text-sm"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-2">
                    <input
                      className="w-full px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                      defaultValue={rule.name || ""}
                      onBlur={(e) => updateRule(rule.id, { name: e.target.value.trim() || rule.name })}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="number"
                        className="px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                        defaultValue={rule.priority ?? 100}
                        onBlur={(e) => updateRule(rule.id, { priority: Number(e.target.value || 100) })}
                      />
                      <select
                        className="px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                        defaultValue={rule.applyType || "always"}
                        onBlur={(e) => updateRule(rule.id, { applyType: e.target.value })}
                      >
                        <option value="always">Always</option>
                        <option value="contains">Contains text</option>
                      </select>
                      <input
                        className="px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                        defaultValue={rule.applyValue || ""}
                        placeholder="Apply value"
                        onBlur={(e) => updateRule(rule.id, { applyValue: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="w-full min-h-28 px-2 py-1 rounded bg-sidebar border border-black/10 dark:border-white/10"
                      defaultValue={rule.content || ""}
                      onBlur={(e) => updateRule(rule.id, { content: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {status && <p className="text-sm text-text-muted">{status}</p>}
    </div>
  );
}

