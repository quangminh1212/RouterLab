"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { fetchWithTimeout } from "@/shared/utils/fetch";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;
const COMBO_SETTINGS_TIMEOUT_MS = 5000;

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [savingStrategy, setSavingStrategy] = useState({});
  const { copied, copy } = useCopyToClipboard();

  const fetchData = async () => {
    try {
      const [combosRes, providersRes] = await Promise.all([
        fetch("/api/combos", { cache: "no-store" }),
        fetch("/api/providers", { cache: "no-store" }),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();

      if (combosRes.ok) setCombos(combosData.combos || []);
      if (providersRes.ok) {
        setActiveProviders(providersData.connections || []);
      }

      if (combosData.combos && combosData.combos.length > 0) {
        try {
          const settingsRes = await fetchWithTimeout("/api/settings", { cache: "no-store" }, COMBO_SETTINGS_TIMEOUT_MS, "Settings fetch timed out");
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            setComboStrategies(settingsData.comboStrategies || {});
          }
        } catch {
          // silent fail — strategies remain empty
        }
      }
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleCreate = async (data) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setShowCreateModal(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create combo");
      }
    } catch (error) {
      console.log("Error creating combo:", error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingCombo(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update combo");
      }
    } catch (error) {
      console.log("Error updating combo:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this combo?")) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCombos(combos.filter(c => c.id !== id));
      }
    } catch (error) {
      console.log("Error deleting combo:", error);
    }
  };

  const persistComboStrategies = async (updated) => {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comboStrategies: updated }),
    });
  };

  const handleToggleRoundRobin = async (comboName, enabled) => {
    try {
      setSavingStrategy((prev) => ({ ...prev, [comboName]: true }));
      const updated = { ...comboStrategies };
      const currentSticky = comboStrategies[comboName]?.stickyRoundRobinLimit || 1;
      if (enabled) {
        updated[comboName] = {
          fallbackStrategy: "round-robin",
          stickyRoundRobinLimit: currentSticky,
        };
      } else {
        delete updated[comboName];
      }

      await persistComboStrategies(updated);
      setComboStrategies(updated);
    } catch (error) {
      console.log("Error updating combo strategy:", error);
    } finally {
      setSavingStrategy((prev) => ({ ...prev, [comboName]: false }));
    }
  };

  const handleStickyLimitChange = async (comboName, value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;

    const updated = {
      ...comboStrategies,
      [comboName]: {
        fallbackStrategy: "round-robin",
        stickyRoundRobinLimit: parsed,
      },
    };

    setComboStrategies(updated);

    try {
      setSavingStrategy((prev) => ({ ...prev, [comboName]: true }));
      await persistComboStrategies(updated);
    } catch (error) {
      console.log("Error updating combo sticky limit:", error);
      await fetchData();
    } finally {
      setSavingStrategy((prev) => ({ ...prev, [comboName]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Combos</h1>
          <p className="text-sm text-text-muted mt-1">
            Create model combos with fallback support
          </p>
        </div>
        <Button icon="add" onClick={() => setShowCreateModal(true)}>
          Create Combo
        </Button>
      </div>

      {/* OpenClaw Combo Section */}
      {(() => {
        const openclawCombo = combos.find(c => c.name === "openclaw");
        if (openclawCombo) {
          return (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">OpenClaw</h2>
              <ComboCard
                combo={openclawCombo}
                copied={copied}
                onCopy={copy}
                onEdit={() => setEditingCombo(openclawCombo)}
                onDelete={() => handleDelete(openclawCombo.id)}
                roundRobinEnabled={comboStrategies[openclawCombo.name]?.fallbackStrategy === "round-robin"}
                stickyLimit={comboStrategies[openclawCombo.name]?.stickyRoundRobinLimit || 1}
                savingStrategy={!!savingStrategy[openclawCombo.name]}
                onToggleRoundRobin={(enabled) => handleToggleRoundRobin(openclawCombo.name, enabled)}
                onStickyLimitChange={(value) => handleStickyLimitChange(openclawCombo.name, value)}
              />
            </div>
          );
        }
        return null;
      })()}

      {/* Other Combos Section */}
      {(() => {
        const otherCombos = combos.filter(c => c.name !== "openclaw");
        if (otherCombos.length === 0 && !combos.find(c => c.name === "openclaw")) {
          return (
            <Card>
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                  <span className="material-symbols-outlined text-[32px]">layers</span>
                </div>
                <p className="text-text-main font-medium mb-1">No combos yet</p>
                <p className="text-sm text-text-muted mb-4">Create model combos with fallback support</p>
                <Button icon="add" onClick={() => setShowCreateModal(true)}>
                  Create Combo
                </Button>
              </div>
            </Card>
          );
        }
        if (otherCombos.length === 0) return null;
        return (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Kết hợp</h2>
            <div className="flex flex-col gap-4">
              {otherCombos.map((combo) => (
                <ComboCard
                  key={combo.id}
                  combo={combo}
                  copied={copied}
                  onCopy={copy}
                  onEdit={() => setEditingCombo(combo)}
                  onDelete={() => handleDelete(combo.id)}
                  roundRobinEnabled={comboStrategies[combo.name]?.fallbackStrategy === "round-robin"}
                  stickyLimit={comboStrategies[combo.name]?.stickyRoundRobinLimit || 1}
                  savingStrategy={!!savingStrategy[combo.name]}
                  onToggleRoundRobin={(enabled) => handleToggleRoundRobin(combo.name, enabled)}
                  onStickyLimitChange={(value) => handleStickyLimitChange(combo.name, value)}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Create Modal - Use key to force remount and reset state */}
      <ComboFormModal
        key="create"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        activeProviders={activeProviders}
      />

      {/* Edit Modal - Use key to force remount and reset state */}
      <ComboFormModal
        key={editingCombo?.id || "new"}
        isOpen={!!editingCombo}
        combo={editingCombo}
        onClose={() => setEditingCombo(null)}
        onSave={(data) => handleUpdate(editingCombo.id, data)}
        activeProviders={activeProviders}
      />
    </div>
  );
}

function ComboCard({ combo, copied, onCopy, onEdit, onDelete, roundRobinEnabled, stickyLimit = 1, savingStrategy = false, onToggleRoundRobin, onStickyLimitChange }) {
  const [showInModels, setShowInModels] = useState(combo.showInModelsEndpoint !== false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setShowInModels(combo.showInModelsEndpoint !== false);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [combo.showInModelsEndpoint]);

  const handleToggleModelsVisibility = async (enabled) => {
    const previous = showInModels;
    setShowInModels(enabled);
    setSavingVisibility(true);
    try {
      const res = await fetch(`/api/combos/${combo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showInModelsEndpoint: enabled }),
      });
      if (!res.ok) {
        setShowInModels(previous);
      }
    } catch {
      setShowInModels(previous);
    } finally {
      setSavingVisibility(false);
    }
  };

  return (
    <Card padding="sm" className="group">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">layers</span>
          </div>
          <div className="min-w-0 flex-1">
            <code className="text-sm font-medium font-mono truncate">{combo.name}</code>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {combo.models.length === 0 ? (
                <span className="text-xs text-text-muted italic">No models</span>
              ) : (
                combo.models.slice(0, 3).map((model, index) => (
                  <code key={index} className="text-[10px] font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-text-muted">
                    {model}
                  </code>
                ))
              )}
              {combo.models.length > 3 && (
                <span className="text-[10px] text-text-muted">+{combo.models.length - 3} more</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-white/10 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.02]">
            <span className="text-xs text-text-muted font-medium whitespace-nowrap">Show in /models</span>
            <Toggle
              size="sm"
              checked={showInModels}
              onChange={handleToggleModelsVisibility}
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-white/10 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.02]">
            <span className="text-xs text-text-muted font-medium">Round Robin</span>
            <Toggle
              size="sm"
              checked={roundRobinEnabled}
              onChange={onToggleRoundRobin}
            />
          </div>

          {roundRobinEnabled && (
            <div className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-white/10 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.02]">
              <span className="text-xs text-text-muted font-medium whitespace-nowrap">Sticky</span>
              <input
                type="number"
                min="1"
                step="1"
                value={stickyLimit}
                onChange={(e) => onStickyLimitChange?.(e.target.value)}
                className="w-16 rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs text-text-main outline-none focus:border-primary"
                title="Giữ cùng model trong N requests trước khi rotate"
              />
              <span className="text-[11px] text-text-muted whitespace-nowrap">req</span>
            </div>
          )}

          {(savingStrategy || savingVisibility) && (
            <span className="text-[11px] text-text-muted">Saving...</span>
          )}

          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(combo.name, `combo-${combo.id}`); }}
              className="flex flex-col items-center px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-primary transition-colors"
              title="Copy combo name"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied === `combo-${combo.id}` ? "check" : "content_copy"}
              </span>
              <span className="text-[10px] leading-tight">Copy</span>
            </button>
            <button
              onClick={onEdit}
              className="flex flex-col items-center px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-primary transition-colors"
              title="Edit"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              <span className="text-[10px] leading-tight">Edit</span>
            </button>
            <button
              onClick={onDelete}
              className="flex flex-col items-center px-2 py-1 rounded hover:bg-red-500/10 text-red-500 transition-colors"
              title="Delete"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              <span className="text-[10px] leading-tight">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Inline editable model item
function ModelItem({ index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model); // revert if empty or unchanged
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(model); setEditing(false); }
  };

  return (
    <div className="group flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
      {/* Index badge */}
      <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">{index + 1}</span>

      {/* Inline editable model value */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-black/20 border border-primary/40 rounded outline-none text-text-main"
        />
      ) : (
        <div
          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-mono text-text-main truncate cursor-text hover:bg-black/5 dark:hover:bg-white/5 rounded"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      {/* Priority arrows */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-0.5 rounded ${isFirst ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move up"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-0.5 rounded ${isLast ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move down"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all"
        title="Remove"
      >
        <span className="material-symbols-outlined text-[12px]">close</span>
      </button>
    </div>
  );
}

function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders, kindFilter = null }) {
  // Initialize state with combo values - key prop on parent handles reset on remount
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  const fetchModalData = async () => {
    try {
      const aliasesRes = await fetch("/api/models/alias");
      if (!aliasesRes.ok) return;
      const aliasesData = await aliasesRes.json();
      setModelAliases(aliasesData.aliases || {});
    } catch (error) {
      console.error("Error fetching modal data:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        fetchModalData();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) {
      setModels([...models, model.value]);
    }
  };

  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };

  const handleRemoveModel = (index) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    setModels(newModels);
  };

  const handleMoveDown = (index) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    setModels(newModels);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    await onSave({ name: name.trim(), models });
    setSaving(false);
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Combo" : "Create Combo"}
      >
        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <Input
              label="Combo Name"
              value={name}
              onChange={handleNameChange}
              placeholder="my-combo"
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Only letters, numbers, -, _ and . allowed
            </p>
          </div>

          {/* Models */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Models</label>

            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">layers</span>
                <p className="text-xs text-text-muted">No models added yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto">
                {models.map((model, index) => (
                  <ModelItem
                    key={index}
                    index={index}
                    model={model}
                    isFirst={index === 0}
                    isLast={index === models.length - 1}
                    onEdit={(newVal) => {
                      const updated = [...models];
                      updated[index] = newVal;
                      setModels(updated);
                    }}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                    onRemove={() => handleRemoveModel(index)}
                  />
                ))}
              </div>
            )}

            {/* Add Model button */}
            <button
              onClick={() => setShowModelSelect(true)}
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Model
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={!name.trim() || !!nameError || saving}
            >
              {saving ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Model Select Modal — 9router multi-select: click add / click again remove, stay open */}
      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel}
          onDeselect={handleDeselectModel}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Add Model to Combo"
          kindFilter={kindFilter}
          addedModelValues={models}
          closeOnSelect={false}
        />
      )}
    </>
  );
}
