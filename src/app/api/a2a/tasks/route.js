// A2A REST: GET /api/a2a/tasks — list recent tasks
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
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const tasks = await listTasks({ limit });
  return new Response(JSON.stringify({ object: "list", data: tasks }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
