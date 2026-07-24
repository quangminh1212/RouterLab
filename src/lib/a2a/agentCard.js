// A2A (Agent-to-Agent) protocol — agent card builder.
// Spec: https://github.com/google/A2A — exposed at /.well-known/agent.json
import { SKILLS } from "@/shared/constants/skills.js";

const PROTOCOL_VERSION = "0.2.0";

function resolveBaseUrl(request) {
  try {
    if (request) {
      const url = new URL(request.url);
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    /* ignore */
  }
  return (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 1212}`
  );
}

export function buildAgentCard(request) {
  const baseUrl = resolveBaseUrl(request);
  const skills = SKILLS.filter((s) => !s.isEntry).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    tags: [s.icon || "ai", "router"].filter(Boolean),
    examples: s.endpoint ? [`Use ${s.name} via ${s.endpoint}`] : [],
    inputModes: ["text/plain", "application/json"],
    outputModes: ["text/plain", "application/json"],
  }));

  return {
    name: "RouterLab",
    description:
      "Multi-provider AI router exposing chat, image, speech, embeddings, web search and fetch capabilities through the A2A protocol.",
    url: `${baseUrl}/a2a`,
    provider: {
      organization: "RouterLab",
      url: baseUrl,
    },
    version: PROTOCOL_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    documentationUrl: `${baseUrl}/dashboard/skills`,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills,
  };
}
