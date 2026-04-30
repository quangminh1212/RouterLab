"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal, Tooltip } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { downloadCliApplyBat } from "@/lib/cliToolBat";
import Image from "next/image";

function ClaudeSettingsSelect({ label, value, options, onChange, className }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors",
          "border-black/10 bg-white text-slate-900 hover:border-black/20 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-black/10",
          "dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#F5F5F5] dark:hover:border-white/20 dark:hover:bg-[#242424] dark:focus:ring-white/15"
        )}
      >
        <span className="truncate font-medium">{selectedOption?.label || ""}</span>
        <span className={cn(
          "material-symbols-outlined text-[18px] text-slate-500 transition-transform dark:text-[#A3A3A3]",
          open && "rotate-180"
        )}>
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#171717] dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <div role="listbox" aria-label={label} className="flex flex-col gap-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-sky-50 text-slate-900 dark:bg-[#21313A] dark:text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-[#D4D4D4] dark:hover:bg-white/5 dark:hover:text-white"
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{option.label}</div>
                    {option.description && (
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-[#A3A3A3]">{option.description}</div>
                    )}
                  </div>
                  {isSelected && <span className="material-symbols-outlined mt-0.5 shrink-0 text-[16px] text-sky-600 dark:text-[#D4D4D4]">check</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClaudeSettingsSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition-all duration-200",
        "focus:outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/15",
        checked
          ? "border-amber-500/40 bg-amber-500"
          : "border-black/10 bg-slate-300 hover:bg-slate-400 dark:border-white/10 dark:bg-[#2A2A2A] dark:hover:bg-[#303030]"
      )}
    >
      <span
        className={cn(
          "size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}


const VALID_CLAUDE_DEFAULT_MODES = new Set(["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"]);

function getInitialDefaultMode(value) {
  return typeof value === "string" && VALID_CLAUDE_DEFAULT_MODES.has(value) ? value : "acceptEdits";
}

export default function ClaudeToolCard({
  tool,
  isExpanded,
  onToggle,
  activeProviders,
  modelMappings,
  onModelMappingChange,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  cloudEnabled,
  cloudUrl,
  initialStatus,
}) {
  const [claudeStatus, setClaudeStatus] = useState(initialStatus || null);
  const [checkingClaude, setCheckingClaude] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEditingAlias, setCurrentEditingAlias] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [ccFilterNaming, setCcFilterNaming] = useState(false);
  const [claudeDefaultMode, setClaudeDefaultMode] = useState(getInitialDefaultMode(initialStatus?.settings?.defaultMode));

  const [claudeEffortLevel, setClaudeEffortLevel] = useState(initialStatus?.settings?.effortLevel || "high");
  const [claudeAlwaysThinkingEnabled, setClaudeAlwaysThinkingEnabled] = useState(
    typeof initialStatus?.settings?.alwaysThinkingEnabled === "boolean"
      ? initialStatus.settings.alwaysThinkingEnabled
      : true
  );
  const hasInitializedModels = useRef(false);

  const DEFAULT_MODE_OPTIONS = [
    {
      value: "default",
      label: "Ask before edits",
      description: "Claude will ask for approval before making each edit",
    },
    {
      value: "acceptEdits",
      label: "Edit automatically",
      description: "Claude will edit your selected text or the whole file",
    },
    {
      value: "plan",
      label: "Plan mode",
      description: "Claude will explore the code and present a plan before editing",
    },
    {
      value: "bypassPermissions",
      label: "Bypass permissions",
      description: "Claude will not ask for approval before running potentially dangerous commands",
    },
  ];
  const EFFORT_LEVEL_OPTIONS = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "XHigh" },
    { value: "max", label: "Max" },
  ];

  const getConfigStatus = () => {
    if (!claudeStatus?.installed) return null;
    const currentUrl = claudeStatus.settings?.env?.ANTHROPIC_BASE_URL;
    if (!currentUrl) return "not_configured";
    const localMatch = currentUrl.includes("localhost") || currentUrl.includes("127.0.0.1");
    const cloudMatch = cloudEnabled && cloudUrl && currentUrl.startsWith(cloudUrl);
    const tunnelMatch = baseUrl && currentUrl.startsWith(baseUrl);
    if (localMatch || cloudMatch || tunnelMatch) return "configured";
    return "other";
  };

  const configStatus = getConfigStatus();

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (initialStatus) setClaudeStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (isExpanded && !claudeStatus) {
      checkClaudeStatus();
      fetchModelAliases();
    }
    if (isExpanded) fetchModelAliases();
  }, [isExpanded]);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      setCcFilterNaming(!!data.ccFilterNaming);
    }).catch(() => {});
  }, []);

  const handleCcFilterNamingToggle = async (e) => {
    const value = e.target.checked;
    setCcFilterNaming(value);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ccFilterNaming: value }),
    }).catch(() => {});
  };

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  useEffect(() => {
    if (claudeStatus?.installed && !hasInitializedModels.current) {
      hasInitializedModels.current = true;
      const env = claudeStatus.settings?.env || {};

      tool.defaultModels.forEach((model) => {
        if (model.envKey) {
          const value = env[model.envKey] || model.defaultValue || "";
          // Only sync initial values from file once
          if (value) {
            onModelMappingChange(model.alias, value);
          }
        }
      });
      // Only set selectedApiKey if it exists in apiKeys list
      const tokenFromFile = env.ANTHROPIC_AUTH_TOKEN;
      if (tokenFromFile && apiKeys?.some(k => k.key === tokenFromFile)) {
        setSelectedApiKey(tokenFromFile);
      }
      setClaudeDefaultMode(getInitialDefaultMode(claudeStatus.settings?.defaultMode));
      setClaudeEffortLevel(claudeStatus.settings?.effortLevel || "high");
      setClaudeAlwaysThinkingEnabled(
        typeof claudeStatus.settings?.alwaysThinkingEnabled === "boolean"
          ? claudeStatus.settings.alwaysThinkingEnabled
          : true
      );
    }
  }, [claudeStatus, apiKeys, tool.defaultModels, onModelMappingChange]);


  const checkClaudeStatus = async () => {
    setCheckingClaude(true);
    try {
      const res = await fetch("/api/cli-tools/claude-settings");
      const data = await res.json();
      setClaudeStatus(data);
    } catch (error) {
      setClaudeStatus({ installed: false, error: error.message });
    } finally {
      setCheckingClaude(false);
    }
  };

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || baseUrl;
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const getDisplayUrl = () => {
    const url = customBaseUrl || baseUrl;
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const buildApplyPayload = () => {
    const env = { ANTHROPIC_BASE_URL: getEffectiveBaseUrl() };

    const keyToUse = selectedApiKey?.trim()
      || (apiKeys?.length > 0 ? apiKeys[0].key : null)
      || (!cloudEnabled ? "sk_xlabrouter" : null);

    if (keyToUse) {
      env.ANTHROPIC_AUTH_TOKEN = keyToUse;
    }

    tool.defaultModels.forEach((model) => {
      const targetModel = modelMappings[model.alias];
      if (targetModel && model.envKey) env[model.envKey] = targetModel;
    });

    return {
      env,
      defaultMode: claudeDefaultMode,
      effortLevel: claudeEffortLevel,
      alwaysThinkingEnabled: claudeAlwaysThinkingEnabled,
    };
  };

  const handleDownloadBat = () => {
    downloadCliApplyBat({
      appUrl: typeof window !== "undefined" ? window.location.origin : baseUrl,
      endpoint: "/api/cli-tools/claude-settings",
      payload: buildApplyPayload(),
      toolName: tool.name,
      filename: "apply-claude-code-settings.bat",
    });
  };

  const handleApplySettings = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const payload = buildApplyPayload();
      const res = await fetch("/api/cli-tools/claude-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings applied successfully!" });
        setClaudeStatus((prev) => ({
          ...prev,
          hasBackup: true,
          settings: {
            ...(prev?.settings || {}),
            hasCompletedOnboarding: true,
            defaultMode: payload.defaultMode,
            alwaysThinkingEnabled: payload.alwaysThinkingEnabled,
            effortLevel: payload.effortLevel,
            env: payload.env,
          },
        }));
      } else {
        setMessage({ type: "error", text: data.error || "Failed to apply settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleResetSettings = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/claude-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings reset successfully!" });
        tool.defaultModels.forEach((model) => onModelMappingChange(model.alias, model.defaultValue || ""));
        setSelectedApiKey("");
        setClaudeDefaultMode(getInitialDefaultMode("acceptEdits"));
        setClaudeEffortLevel("high");
        setClaudeAlwaysThinkingEnabled(true);
        setClaudeStatus((prev) => ({
          ...prev,
          hasxlabrouter: false,
          settings: prev?.settings
            ? {
                ...prev.settings,
                env: Object.fromEntries(
                  Object.entries(prev.settings.env || {}).filter(
                    ([key]) => ![
                      "ANTHROPIC_BASE_URL",
                      "ANTHROPIC_AUTH_TOKEN",
                      "ANTHROPIC_DEFAULT_OPUS_MODEL",
                      "ANTHROPIC_DEFAULT_SONNET_MODEL",
                      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
                      "API_TIMEOUT_MS",
                    ].includes(key)
                  )
                ),
              }
            : prev?.settings,
        }));
      } else {
        setMessage({ type: "error", text: data.error || "Failed to reset settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoring(false);
    }
  };

  const openModelSelector = (alias) => {
    setCurrentEditingAlias(alias);
    setModalOpen(true);
  };

  const handleModelSelect = (model) => {
    if (currentEditingAlias) onModelMappingChange(currentEditingAlias, model.value);
  };

  // Generate settings.json content for manual copy
  const getManualConfigs = () => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim()) 
      ? selectedApiKey 
      : (!cloudEnabled ? "sk_xlabrouter" : "<API_KEY_FROM_DASHBOARD>");
    const env = { ANTHROPIC_BASE_URL: getEffectiveBaseUrl(), ANTHROPIC_AUTH_TOKEN: keyToUse };
    tool.defaultModels.forEach((model) => {
      const targetModel = modelMappings[model.alias];
      if (targetModel && model.envKey) env[model.envKey] = targetModel;
    });
    
    return [
      {
        filename: "~/.claude/settings.json",
        content: JSON.stringify({ hasCompletedOnboarding: true, defaultMode: claudeDefaultMode, alwaysThinkingEnabled: claudeAlwaysThinkingEnabled, effortLevel: claudeEffortLevel, env }, null, 2),
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <div className="flex items-center justify-between hover:cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <Image src="/providers/claude.png" alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{tool.name}</h3>
              {configStatus === "configured" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">Connected</span>}
              {configStatus === "not_configured" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full">Not configured</span>}
              {configStatus === "other" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">Other</span>}
            </div>
            <p className="text-xs text-text-muted truncate">{tool.description}</p>
          </div>
        </div>
        <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checkingClaude && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking Claude CLI...</span>
            </div>
          )}

          {!checkingClaude && claudeStatus && !claudeStatus.installed && showInstallGuide && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface border border-border rounded-lg">
                <h4 className="font-medium mb-3">Installation Guide</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-text-muted mb-1">macOS / Linux / Windows:</p>
                    <code className="block px-3 py-2 bg-black/5 dark:bg-white/5 rounded font-mono text-xs">npm install -g @anthropic-ai/claude-code</code>
                  </div>
                  <p className="text-text-muted">After installation, run <code className="px-1 bg-black/5 dark:bg-white/5 rounded">claude</code> to verify.</p>
                </div>
              </div>
            </div>
          )}

          {!checkingClaude && claudeStatus && (
            <>
              {!claudeStatus.installed && (
                <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-yellow-500">warning</span>
                    <div className="flex-1">
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">Claude CLI not detected locally</p>
                      <p className="text-sm text-text-muted">Manual configuration is still available if XLab Router is deployed on a remote server.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <Button variant="outline" size="sm" onClick={() => setShowInstallGuide(!showInstallGuide)}>
                      <span className="material-symbols-outlined text-[18px] mr-1">{showInstallGuide ? "expand_less" : "help"}</span>
                      {showInstallGuide ? "Hide" : "How to Install"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {/* Current Base URL */}
                {claudeStatus?.settings?.env?.ANTHROPIC_BASE_URL && (
                  <div className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Current</span>
                    <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                    <span className="flex-1 px-2 py-1.5 text-xs text-text-muted truncate">
                      {claudeStatus.settings.env.ANTHROPIC_BASE_URL}
                    </span>
                  </div>
                )}

                {/* Base URL */}
                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Base URL</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  <input 
                    type="text" 
                    value={getDisplayUrl()} 
                    onChange={(e) => setCustomBaseUrl(e.target.value)} 
                    placeholder="https://.../v1" 
                    className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" 
                  />
                  {customBaseUrl && customBaseUrl !== baseUrl && (
                    <button onClick={() => setCustomBaseUrl("")} className="p-1 text-text-muted hover:text-primary rounded transition-colors" title="Reset to default">
                      <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    </button>
                  )}
                </div>

                {/* API Key */}
                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">API Key</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  {apiKeys.length > 0 ? (
                    <select value={selectedApiKey} onChange={(e) => setSelectedApiKey(e.target.value)} className="flex-1 px-2 py-1.5 bg-surface rounded text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary/50">
                      {apiKeys.map((key) => <option key={key.id} value={key.key}>{key.key}</option>)}
                    </select>
                  ) : (
                    <span className="flex-1 text-xs text-text-muted px-2 py-1.5">
                      {cloudEnabled ? "No API keys - Create one in Keys page" : "sk_xlabrouter (default)"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Default mode</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  <div className="flex-1">
                    <ClaudeSettingsSelect
                      label="Default mode"
                      value={claudeDefaultMode}
                      options={DEFAULT_MODE_OPTIONS}
                      onChange={setClaudeDefaultMode}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Effort</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  <div className="flex-1">
                    <ClaudeSettingsSelect
                      label="Effort"
                      value={claudeEffortLevel}
                      options={EFFORT_LEVEL_OPTIONS}
                      onChange={setClaudeEffortLevel}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Always thinking</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  <div className="flex flex-1 items-center justify-between rounded-xl border border-white/10 bg-[#1F1F1F] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <span className="text-sm font-medium text-[#F5F5F5]">
                      {claudeAlwaysThinkingEnabled ? "On" : "Off"}
                    </span>
                    <ClaudeSettingsSwitch
                      checked={claudeAlwaysThinkingEnabled}
                      onChange={setClaudeAlwaysThinkingEnabled}
                    />
                  </div>
                </div>

                {/* Model Mappings */}
                {tool.defaultModels.map((model) => (
                  <div key={model.alias} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">{model.name}</span>
                    <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                    <input type="text" value={modelMappings[model.alias] || ""} onChange={(e) => onModelMappingChange(model.alias, e.target.value)} placeholder="provider/model-id" className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <button onClick={() => openModelSelector(model.alias)} className="px-2 py-1.5 rounded border text-xs transition-colors shrink-0 whitespace-nowrap bg-surface border-border text-text-main hover:border-primary cursor-pointer">Select Model</button>
                    {modelMappings[model.alias] && <button onClick={() => onModelMappingChange(model.alias, "")} className="p-1 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
                  </div>
                ))}

                {/* CC Filter Naming */}
                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">Filter naming</span>
                  <span className="material-symbols-outlined text-text-muted text-[14px]">arrow_forward</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={ccFilterNaming} onChange={handleCcFilterNamingToggle} className="w-3.5 h-3.5 accent-primary cursor-pointer" />
                    <span className="text-xs text-text-muted">Filter naming requests</span>
                  </label>
                  <Tooltip text="Intercepts Claude Code's topic-naming requests and returns a fake response locally, saving API tokens.">
                    <span className="material-symbols-outlined text-text-muted text-[14px] cursor-help">info</span>
                  </Tooltip>
                </div>
              </div>

              {message && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                  <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
                  <span>{message.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleApplySettings} loading={applying}>
                  <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetSettings} disabled={!claudeStatus?.hasxlabrouter} loading={restoring}>
                  <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)}>
                  <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ModelSelectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSelect={handleModelSelect} selectedModel={currentEditingAlias ? modelMappings[currentEditingAlias] : null} activeProviders={activeProviders} modelAliases={modelAliases} title={`Select model for ${currentEditingAlias}`} />
      
      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title="Claude CLI - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
