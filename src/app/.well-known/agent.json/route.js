// A2A agent card discovery endpoint: GET /.well-known/agent.json
import { buildAgentCard } from "@/lib/a2a/agentCard.js";

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
  return new Response(JSON.stringify(card, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
