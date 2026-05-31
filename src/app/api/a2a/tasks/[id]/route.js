// A2A REST: GET /api/a2a/tasks/:id — retrieve a single task
import { getTask } from "@/lib/agentJobsDb.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) {
    return new Response(JSON.stringify({ error: { message: `Task not found: ${id}`, type: "not_found" } }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  return new Response(JSON.stringify(task), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
