import { withRouteGuard } from "@/lib/runtimeGuard";

const CHAT_COMPLETIONS_URL = "http://127.0.0.1:1212/v1/chat/completions";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

function normalizePrompt(prompt) {
  if (Array.isArray(prompt)) return prompt.map((item) => String(item || "")).join("\n");
  return String(prompt || "");
}

function completionFromChat(payload) {
  const choice = payload?.choices?.[0] || {};
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  return {
    id: payload?.id || `cmpl-${Date.now()}`,
    object: "text_completion",
    created: payload?.created || Math.floor(Date.now() / 1000),
    model: payload?.model || "openclaw",
    choices: [
      {
        text,
        index: 0,
        logprobs: null,
        finish_reason: choice?.finish_reason || "stop",
      },
    ],
    usage: payload?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function postHandler(request) {
  const body = await request.json().catch(() => ({}));
  const model = String(body?.model || "openclaw");
  const prompt = normalizePrompt(body?.prompt);
  const maxTokens = Number(body?.max_tokens || 1024);
  const temperature = typeof body?.temperature === "number" ? body.temperature : undefined;
  const topP = typeof body?.top_p === "number" ? body.top_p : undefined;

  const chatBody = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    stream: false,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { top_p: topP } : {}),
  };

  const auth = request.headers.get("authorization") || "";
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(chatBody),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    return new Response(text || JSON.stringify({ error: { message: "Upstream completion error" } }), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return Response.json(completionFromChat(payload), {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export const POST = withRouteGuard(
  "v1/completions",
  postHandler,
  { timeoutMs: 45000 },
);
