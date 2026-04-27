export async function GET() {
  try {
    const sources = [
      {
      id: "openai-codex-curated",
      url: null,
      label: "OpenAI Codex",
      plugins: [
        { name: "gmail", description: "Read and manage Gmail messages", category: "Productivity", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://www.google.com/gmail/about/static/images/logo-gmail.png" },
        { name: "google-drive", description: "Work across Drive, Docs, Sheets, and Slides", category: "Productivity", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png" },
        { name: "slack", description: "Summarize channels or draft replies", category: "Communication", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://a.slack-edge.com/80588/marketing/img/meta/slack_hash_256.png" },
        { name: "github", description: "Triage PRs, issues, CI, and publish workflows", category: "Development", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://github.githubassets.com/favicons/favicon.svg" },
        { name: "linear", description: "Manage issues and project tracking", category: "Development", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://linear.app/apple-touch-icon.png" },
        { name: "notion", description: "Read and write Notion pages and databases", category: "Productivity", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://www.notion.so/images/logo-ios.png" },
        { name: "jira", description: "Manage Jira issues and projects", category: "Development", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon.png" },
        { name: "figma", description: "Read and inspect Figma designs", category: "Design", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://static.figma.com/app/icon/1/favicon.png" },
        { name: "vercel", description: "Build and deploy web apps and agents", category: "Infrastructure", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://assets.vercel.com/image/upload/front/favicon/vercel/57x57.png" },
        { name: "sentry", description: "Inspect recent Sentry issues and events", category: "Infrastructure", homepage: "https://developers.openai.com/codex/plugins", iconUrl: "https://sentry-brand.storage.googleapis.com/sentry-glyph-black.png" },
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
          sourceLabel: source.label,
          sourceId: source.id,
          iconUrl: plugin.iconUrl || "",
          homepage: plugin.homepage || "",
          sourceUrl: plugin.homepage || "",
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
            sourceLabel: source.label,
            sourceId: source.id,
            iconUrl: plugin.icon || plugin.icon_url || plugin.logo || "",
            homepage: plugin.homepage || "",
            sourceUrl: source.url || "",
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
