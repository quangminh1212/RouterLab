"use client";

import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";

export default function EndpointApiKeysCard({
  keysLoading,
  keys,
  requireApiKey,
  onToggleRequireApiKey,
  onOpenCreateKey,
  visibleKeys,
  maskKey,
  onToggleKeyVisibility,
  onCopyKey,
  copied,
  onEditKey,
  onToggleKeyActive,
  onDeleteKey,
}) {
  return (
    <Card id="require-api-key">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <Button icon="add" onClick={onOpenCreateKey}>
          Create Key
        </Button>
      </div>

      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
        <div>
          <p className="font-medium">Require API key</p>
          <p className="text-sm text-text-muted">
            Requests without a valid key will be rejected
          </p>
        </div>
        <Toggle
          checked={requireApiKey}
          onChange={() => onToggleRequireApiKey(!requireApiKey)}
        />
      </div>

      {keysLoading ? (
        <div className="flex flex-col gap-3">
          <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">vpn_key</span>
          </div>
          <p className="text-text-main font-medium mb-1">No API keys yet</p>
          <p className="text-sm text-text-muted mb-4">Create your first API key to get started</p>
          <Button icon="add" onClick={onOpenCreateKey}>
            Create Key
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => {
            const visibleModels = Array.isArray(key.allowedModels) && key.allowedModels.length > 0
              ? key.allowedModels.slice(0, 2)
              : [];
            const hiddenCount = Array.isArray(key.allowedModels) && key.allowedModels.length > 2
              ? key.allowedModels.length - 2
              : 0;

            return (
              <div
                key={key.id}
                className={`group flex items-start justify-between gap-4 rounded-lg border border-border bg-surface/50 p-3 transition ${key.isActive === false ? "opacity-60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium text-text-main">{key.name}</p>
                    {key.isActive === false && (
                      <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <code className="rounded bg-black/5 px-2 py-0.5 font-mono text-xs text-text-muted dark:bg-white/5">
                      {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                    </code>
                    <button
                      onClick={() => onToggleKeyVisibility(key.id)}
                      className="rounded p-1 text-text-muted transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                      title={visibleKeys.has(key.id) ? "Hide" : "Show"}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {visibleKeys.has(key.id) ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                    <button
                      onClick={() => onCopyKey(key.key, key.id)}
                      className="rounded p-1 text-text-muted transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copied === key.id ? "check" : "content_copy"}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>
                      Chi ph?: {Number.isFinite(Number(key.costLimit)) && Number(key.costLimit) > 0
                        ? `$${Number(key.usedCost || 0).toFixed(2)} / $${Number(key.costLimit).toFixed(2)}`
                        : `$${Number(key.usedCost || 0).toFixed(2)} / Unlimited`}
                    </span>
                    <span>?</span>
                    <span>
                      RPM: {Number.isFinite(Number(key.rpmLimit)) && Number(key.rpmLimit) > 0
                        ? Math.floor(Number(key.rpmLimit))
                        : "Unlimited"}
                    </span>
                    <span>?</span>
                    <span>
                      Models: {Array.isArray(key.allowedModels) && key.allowedModels.length > 0
                        ? `${key.allowedModels.length} model${key.allowedModels.length > 1 ? "s" : ""}`
                        : "All"}
                    </span>
                  </div>

                  {visibleModels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {visibleModels.map((model) => (
                        <span key={model} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {model}
                        </span>
                      ))}
                      {hiddenCount > 0 && (
                        <span className="inline-flex items-center rounded-md bg-black/5 px-2 py-0.5 text-xs text-text-muted dark:bg-white/5">
                          +{hiddenCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditKey(key)}
                    className="rounded p-1.5 text-text-muted transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <Toggle
                    size="sm"
                    checked={key.isActive ?? true}
                    onChange={(checked) => {
                      if (key.isActive && !checked) {
                        if (confirm(`Pause "${key.name}"?`)) {
                          onToggleKeyActive(key.id, checked);
                        }
                      } else {
                        onToggleKeyActive(key.id, checked);
                      }
                    }}
                  />
                  <button
                    onClick={() => onDeleteKey(key.id)}
                    className="rounded p-1.5 text-red-500 transition hover:bg-red-500/10"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
