// A2A protocol JSON-RPC endpoint: POST /a2a
// Methods: message/send, message/stream, tasks/get, tasks/cancel
import { withRouteGuard } from "@/lib/runtimeGuard";
import { runTask, streamTask } from "@/lib/a2a/executor.js";
import { getTask, updateTask } from "@/lib/agentJobsDb.js";
import { ensureAuthorized } from "../api/v1/_lib/apiAuth.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}

function rpcResult(id, result) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function rpcError(id, code, message, httpStatus = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status: httpStatus,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function taskToRpc(task) {
  if (!task) return null;
  return {
    id: task.id,
    contextId: task.contextId,
    kind: "task",
    status: { state: task.state, timestamp: new Date((task.updated_at || 0) * 1000).toISOString() },
    artifacts: task.artifacts || [],
    error: task.error || undefined,
  };
}

async function postHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) {
    // Return JSON-RPC shaped auth error.
    return rpcError(null, -32001, "Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(body?.id, -32600, "Invalid Request");
  }

  const { id, method, params } = body;

  switch (method) {
    case "message/send": {
      const task = await runTask(params || {});
      return rpcResult(id, taskToRpc(task));
    }

    case "message/stream": {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (event) => {
            const envelope = { jsonrpc: "2.0", id: id ?? null, result: event };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`));
          };
          try {
            for await (const event of streamTask(params || {})) {
              send(event);
            }
          } catch (err) {
            send({ type: "status-update", status: { state: "failed", error: { message: err?.message } }, final: true });
          } finally {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          ...CORS,
        },
      });
    }

    case "tasks/get": {
      const taskId = params?.id || params?.taskId;
      if (!taskId) return rpcError(id, -32602, "Missing task id");
      const task = await getTask(taskId);
      if (!task) return rpcError(id, -32001, "Task not found");
      return rpcResult(id, taskToRpc(task));
    }

    case "tasks/cancel": {
      const taskId = params?.id || params?.taskId;
      if (!taskId) return rpcError(id, -32602, "Missing task id");
      const task = await getTask(taskId);
      if (!task) return rpcError(id, -32001, "Task not found");
      if (["completed", "failed", "canceled"].includes(task.state)) {
        return rpcError(id, -32002, `Task not cancelable (state: ${task.state})`);
      }
      const updated = await updateTask(taskId, { state: "canceled" });
      return rpcResult(id, taskToRpc(updated));
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export const POST = withRouteGuard("a2a", postHandler, { timeoutMs: 130000 });
