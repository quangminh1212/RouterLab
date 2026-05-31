// A2A REST: POST /api/a2a/tasks/:id/cancel — cancel a task
import { getTask, updateTask } from "@/lib/agentJobsDb.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) {
    return new Response(JSON.stringify({ error: { message: `Task not found: ${id}`, type: "not_found" } }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  if (["completed", "failed", "canceled"].includes(task.state)) {
    return new Response(
      JSON.stringify({ error: { message: `Task not cancelable (state: ${task.state})`, type: "conflict" } }),
      { status: 409, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
  const updated = await updateTask(id, { state: "canceled" });
  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
