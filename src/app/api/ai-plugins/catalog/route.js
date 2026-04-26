export async function GET() {
  try {
    const sources = [
      {
        id: "claude-plugins-official",
        url: "https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json",
        label: "Claude Plugins Official",
      },
      {
        id: "claude-code",
        url: "https://raw.githubusercontent.com/anthropics/claude-code/main/.claude-plugin/marketplace.json",
        label: "Claude Code",
      },
    ];

    const allPlugins = [];
    const errors = [];

    for (const source of sources) {
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
