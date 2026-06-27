import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";

let initialized = false;
let initializePromise = null;

async function ensureInitialized() {
  if (initialized) return;
  if (!initializePromise) {
    initializePromise = Promise.resolve(initTranslators())
      .then(() => { initialized = true; })
      .finally(() => { initializePromise = null; });
  }
  await initializePromise;
}

ensureInitialized().catch(() => {});

const activeSessions = new Map();
let wsCounter = 0;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

/**
 * GET /v1/ws — Establish a WebSocket-like SSE stream.
 * Returns an SSE connection that receives streaming chat responses.
 * Client sends messages via POST /v1/ws with x-ws-session-id header.
 */
export async function GET(request) {
  const sessionId = `ws-${++wsCounter}-${Date.now()}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const session = {
        id: sessionId,
        controller,
        alive: true,
        requestQueue: [],
        processing: false,
      };
      activeSessions.set(sessionId, session);

      const welcome = JSON.stringify({
        type: "session.created",
        session_id: sessionId,
        protocol: "xlabrouter-ws-v1",
      });
      controller.enqueue(encoder.encode(`data: ${welcome}\n\n`));

      const pingInterval = setInterval(() => {
        if (!session.alive) {
          clearInterval(pingInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`:heartbeat\n\n`));
        } catch {
          session.alive = false;
          clearInterval(pingInterval);
          activeSessions.delete(sessionId);
        }
      }, 20000);

      session._pingInterval = pingInterval;
    },
    cancel() {
      const session = activeSessions.get(sessionId);
      if (session) {
        session.alive = false;
        if (session._pingInterval) clearInterval(session._pingInterval);
        activeSessions.delete(sessionId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "X-WS-Session-Id": sessionId,
    },
  });
}

/**
 * POST /v1/ws — Send a message to the WebSocket-like session.
 * The response will be streamed to the SSE connection from GET.
 * Falls back to normal request/response if no session is active.
 */
export async function POST(request) {
  await ensureInitialized();

  const sessionId = request.headers.get("x-ws-session-id");
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
      { status: 400, headers: corsHeaders() }
    );
  }

  const session = sessionId ? activeSessions.get(sessionId) : null;

  if (!session || !session.alive) {
    const forwardedRequest = new Request(request.url.replace("/ws", "/chat/completions"), {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...body, stream: true }),
    });
    return await handleChat(forwardedRequest);
  }

  const encoder = new TextEncoder();
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    session.controller.enqueue(
      encoder.encode(`event: message\ndata: ${JSON.stringify({ type: "request.received", message_id: messageId })}\n\n`)
    );
  } catch {
    activeSessions.delete(sessionId);
    return Response.json({ error: { message: "Session disconnected" } }, { status: 410, headers: corsHeaders() });
  }

  const forwardedRequest = new Request(request.url.replace("/ws", "/chat/completions"), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, stream: true }),
  });

  const response = await handleChat(forwardedRequest);
  const responseBody = response.body;

  if (responseBody) {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            session.controller.enqueue(encoder.encode(`event: chat\ndata: ${line}\n\n`));
          } catch {
            session.alive = false;
            break;
          }
        }
        if (!session.alive) break;
      }
    } finally {
      reader.releaseLock();
    }

    try {
      session.controller.enqueue(
        encoder.encode(`event: message\ndata: ${JSON.stringify({ type: "request.completed", message_id: messageId })}\n\n`)
      );
    } catch {}
  }

  return Response.json(
    { message_id: messageId, status: "streamed_to_session" },
    { headers: corsHeaders() }
  );
}
