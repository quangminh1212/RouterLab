import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;

function chatCompletionToResponsesPayload(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => typeof part?.text === "string" ? part.text : "").join("")
    : typeof content === "string" ? content : "";
  const createdAt = typeof payload?.created === "number"
    ? payload.created
    : Math.floor(Date.now() / 1000);

  return {
    id: payload?.id || `resp_${Date.now()}`,
    object: "response",
    created_at: createdAt,
    status: "completed",
    model: payload?.model,
    output: [
      {
        id: `msg_${Date.now()}`,
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text,
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens ?? 0,
      output_tokens: payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens ?? 0,
      total_tokens: payload?.usage?.total_tokens ?? payload?.usage?.totalTokens ?? 0,
    },
  };
}

async function normalizeResponsesJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const isSse = /\btext\/event-stream\b/i.test(contentType);
  if (!isJson && !isSse) return response;

  const raw = await response.text();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    const trimmed = String(raw || "").trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        payload = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return new Response(raw, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } else {
      return new Response(raw, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }

  if (payload?.object === "chat.completion") {
    return Response.json(chatCompletionToResponsesPayload(payload), {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return Response.json(payload, {
    status: response.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * POST /v1/responses - OpenAI Responses API format
 * Now handled by translator pattern (openai-responses format auto-detected)
 */
async function postHandler(request) {
  await ensureInitialized();
  const response = await handleChat(request);
  return await normalizeResponsesJson(response);
}

export const POST = withRouteGuard(
  "v1/responses",
  postHandler,
  { timeoutMs: 180000 },
);
