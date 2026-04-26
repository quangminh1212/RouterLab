"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardSkeleton, Input, Toggle } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
  selectedPlugins: [],
  selectedSkills: [],
};

function cloneAiIntegrations(value) {
  const source = value && typeof value === "object" ? value : EMPTY_AI_INTEGRATIONS;
  return {
    enabled: source.enabled === true,
    autoConnect: source.autoConnect === true,
    mcpServers: Array.isArray(source.mcpServers) ? source.mcpServers.map((item) => ({ ...item })) : [],
    plugins: Array.isArray(source.plugins) ? source.plugins.map((item) => ({ ...item })) : [],
    selectedPlugins: Array.isArray(source.selectedPlugins) ? source.selectedPlugins.map((item) => ({ ...item })) : [],
    selectedSkills: Array.isArray(source.selectedSkills) ? source.selectedSkills.map((item) => ({ ...item })) : [],
  };
}

function normalizeSkill(item) {
  return {
    id: typeof item?.id === "string" ? item.id : "",
    name: typeof item?.name === "string" ? item.name : "",
    description: typeof item?.description === "string" ? item.description : "",
    source: typeof item?.source === "string" ? item.source : "local-skill-finder",
    enabled: item?.enabled === true,
  };
}

export default function AISkillsPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [skills, setSkills] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [sourcePath, setSourcePath] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = cloneAiIntegrations(data?.aiIntegrations);
        setAiForm(next);
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load AI skills settings" }))
      .finally(() => setLoading(false));
  }, []);

  const integratedSkillIds = useMemo(() => new Set((aiForm.selectedSkills || []).map((item) => item.id).filter(Boolean)), [aiForm.selectedSkills]);
  const selectedSkillsCount = useMemo(() => skills.filter((skill) => skill.enabled).length, [skills]);
  const integratedSkillsCount = useMemo(() => (Array.isArray(aiForm.selectedSkills) ? aiForm.selectedSkills.length : 0), [aiForm.selectedSkills]);

  const searchSkills = async () => {
    setSearching(true);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/ai-skills/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to search skills");

      setSourcePath(data.source || "");
      setSkills(
        (Array.isArray(data.results) ? data.results : [])
          .map(normalizeSkill)
          .map((skill) => ({ ...skill, enabled: integratedSkillIds.has(skill.id) || skill.enabled }))
      );
      setStatus({ type: "success", message: `Loaded ${data.total || 0} skill(s)` });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Skill search failed" });
    } finally {
      setSearching(false);
    }
  };

  const toggleSkill = (index) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setSkills(updated);
  };

  const integrateSkillsToXLab = async () => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const selectedSkills = skills.filter((skill) => skill.enabled).map(normalizeSkill).map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        source: skill.source,
      }));
      const nextForm = { ...aiForm, selectedSkills };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to integrate skills into XLab Router");

      setAiForm(nextForm);
      setStatus({ type: "success", message: `Integrated ${selectedSkills.length} skill(s) into XLab Router` });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Skill integration failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">AI Skills</h1>
          <p className="text-text-muted mt-1">Search local skill-finder catalog and integrate selected skills into XLab Router.</p>
          <p className="text-xs text-text-muted mt-2">
            <strong>Note:</strong> Skills are stored locally in XLab Router settings and do not sync to any CLI.
          </p>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-main">XLab Skill Integration</h2>
              <p className="text-sm text-text-muted mt-1">
                Keep selected skills in XLab Router settings for local AI integration. Currently integrated: {integratedSkillsCount}.
              </p>
              {sourcePath ? <p className="text-xs text-text-muted mt-2 truncate">Source: {sourcePath}</p> : null}
            </div>
            <Button variant="primary" size="sm" loading={saving} disabled={loading || saving || selectedSkillsCount === 0} onClick={integrateSkillsToXLab}>
              Add to XLab
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="flex-1 min-w-[220px]"
                label="Search skills"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="mcp, clean code, auth, react, architecture..."
              />
              <Button variant="secondary" loading={searching} disabled={loading || saving} onClick={searchSkills}>
                Search Skills
              </Button>
            </div>

            {skills.length === 0 ? (
              <p className="text-sm text-text-muted">No skills loaded yet. Search from local skill-finder first.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[520px] overflow-auto pr-1">
                {skills.map((skill, index) => (
                  <Card key={`${skill.id}-${index}`} className="!p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{skill.name}</p>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">{skill.description || "No description"}</p>
                        <p className="text-[11px] text-text-muted mt-1">{skill.id}</p>
                      </div>
                      <Toggle checked={skill.enabled} onChange={() => toggleSkill(index)} size="md" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>

        {status.message ? <p className={cn("text-sm", status.type === "error" ? "text-red-500" : "text-green-500")}>{status.message}</p> : null}
      </div>
    </div>
  );
}
