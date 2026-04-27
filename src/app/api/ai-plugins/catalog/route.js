export async function GET() {
  try {
    const sources = [
      {
      id: "openai-codex-curated",
      url: null,
      label: "OpenAI Codex",
      plugins: [
        { name: "gmail", description: "Read and manage Gmail messages", category: "Productivity", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "google-drive", description: "Work across Drive, Docs, Sheets, and Slides", category: "Productivity", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "slack", description: "Summarize channels or draft replies", category: "Communication", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "github", description: "Triage PRs, issues, CI, and publish workflows", category: "Development", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "linear", description: "Manage issues and project tracking", category: "Development", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "notion", description: "Read and write Notion pages and databases", category: "Productivity", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "jira", description: "Manage Jira issues and projects", category: "Development", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "figma", description: "Read and inspect Figma designs", category: "Design", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "vercel", description: "Build and deploy web apps and agents", category: "Infrastructure", homepage: "https://developers.openai.com/codex/plugins" },
        { name: "sentry", description: "Inspect recent Sentry issues and events", category: "Infrastructure", homepage: "https://developers.openai.com/codex/plugins" },
      ],
    },
  ];

    const allPlugins = [];
    const errors = [];

  for (const source of sources) {
    if (source.url === null && Array.isArray(source.plugins)) {
      for (const plugin of source.plugins) {
        allPlugins.push({
          pluginId: plugin.name || "",
          name: plugin.name || "",
          description: plugin.description || "",
          category: plugin.category || "Other",
          source: source.label,
          sourceId: source.id,
          iconUrl: "",
          homepage: plugin.homepage || "",
          tags: [],
        });
      }
      continue;
    }
    try {
        const res = await fetch(source.url, { cache: "no-store" });
        if (!res.ok) {
          errors.push({ source: source.id, error: `HTTP ${res.status}` });
          continue;
        }
        const data = await res.json();
        const plugins = Array.isArray(data.plugins) ? data.plugins : [];

        for (const plugin of plugins.slice(0, 50)) {
          allPlugins.push({
            pluginId: plugin.name || "",
            name: plugin.name || "",
            description: plugin.description || "",
            category: plugin.category || "Other",
            source: source.label,
            sourceId: source.id,
            iconUrl: plugin.icon || plugin.icon_url || plugin.logo || "",
            homepage: plugin.homepage || "",
            tags: [],
          });
        }
      } catch (error) {
        errors.push({ source: source.id, error: error.message });
      }
    }

    return Response.json({
      plugins: allPlugins,
      sources: sources.map((s) => ({ id: s.id, label: s.label })),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Failed to fetch plugin catalog" }, { status: 500 });
  }
}
