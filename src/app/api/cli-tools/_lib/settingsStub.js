/**
 * Shared stub for optional CLI tool settings endpoints (9router parity).
 * Returns a consistent shape when the full home-dir configurator is not ported.
 */
export function cliToolSettingsResponse(toolId, extra = {}) {
  return {
    tool: toolId,
    installed: false,
    configured: false,
    message:
      `CLI tool '${toolId}' settings endpoint is available for API parity. ` +
      "Install the tool locally and configure via its native config, or use " +
      "dashboard CLI Tools for supported tools (claude/codex/copilot/opencode/hermes/…).",
    ...extra,
  };
}

export async function handleCliToolSettingsGet(toolId) {
  return Response.json(cliToolSettingsResponse(toolId));
}

export async function handleCliToolSettingsPost(toolId, body) {
  return Response.json({
    success: false,
    tool: toolId,
    message:
      `Write settings for '${toolId}' is not fully managed in-process. ` +
      "Use the vendor CLI config or a supported dashboard CLI Tools panel.",
    receivedKeys: body && typeof body === "object" ? Object.keys(body) : [],
  });
}
