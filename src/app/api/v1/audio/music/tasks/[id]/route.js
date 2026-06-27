import { musicTaskStore } from "open-sse/handlers/musicCore.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function getHandler(request, { params }) {
  const { id } = await params;
  const task = musicTaskStore.get(id);

  if (!task) {
    return Response.json(
      { error: { message: `Task '${id}' not found`, type: "not_found_error" } },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  if (task.status === "complete") {
    return Response.json(
      {
        id: task.id,
        object: "audio.music",
        created: task.createdAt,
        data: task.data,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  if (task.status === "error") {
    return Response.json(
      {
        id: task.id,
        object: "audio.music.task",
        status: "error",
        error: task.error,
      },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const { adapter, providerTaskId, credentials, provider, pollIntervalMs, maxPollTimeMs } = task;
  const headers = adapter.buildHeaders(credentials);

  try {
    const clip = await adapter.poll(providerTaskId, headers, { pollIntervalMs, maxPollTimeMs });
    const normalized = adapter.normalize(clip, provider);
    task.status = "complete";
    task.data = [normalized];

    return Response.json(
      {
        id: task.id,
        object: "audio.music",
        created: task.createdAt,
        data: task.data,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    task.status = "error";
    task.error = err.message || "Music generation failed";
    return Response.json(
      {
        id: task.id,
        object: "audio.music.task",
        status: "error",
        error: task.error,
      },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export const GET = withRouteGuard("v1/audio/music/tasks/[id]", getHandler, { timeoutMs: 120000 });
