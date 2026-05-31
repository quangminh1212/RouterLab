// A2A REST: GET /api/a2a/status — protocol availability + agent card summary
import { buildAgentCard } from "@/lib/a2a/agentCard.js";
import { listTasks } from "@/lib/agentJobsDb.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function GET(request) {
  const card = buildAgentCard(request);
  const tasks = await listTasks({ limit: 200 });
  const byState = tasks.reduce((acc, t) => {
    acc[t.state] = (acc[t.state] || 0) + 1;
    return acc;
  }, {});
  return new Response(
    JSON.stringify({
      status: "ok",
      protocol: "a2a",
      protocolVersion: card.protocolVersion,
      agentCardUrl: "/.well-known/agent.json",
      rpcEndpoint: "/a2a",
      skills: card.skills.map((s) => s.id),
      tasks: { total: tasks.length, byState },
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
  );
}
