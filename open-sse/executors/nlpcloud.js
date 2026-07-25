import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

/**
 * NLP Cloud chatbot API (non-OpenAI wire).
 * OmniRoute: open-sse/executors/nlpcloud.ts (simplified)
 */

const DEFAULT_MODEL = "chatdolphin";
const DEFAULT_BASE = "https://api.nlpcloud.io/v1/gpu";

function extractText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((p) => (p?.type === "text" && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function resolvePrompt(messages) {
  if (!Array.isArray(messages)) return { input: "", context: null, history: [] };
  const history = [];
  let context = null;
  let lastUser = "";
  for (const msg of messages) {
    const role = msg?.role;
    const text = extractText(msg?.content);
    if (!text) continue;
    if (role === "system" && !context) context = text;
    else if (role === "user") lastUser = text;
    else if (role === "assistant" && lastUser) {
      history.push({ input: lastUser, response: text });
      lastUser = "";
    }
  }
  // last user without assistant reply is the current input
  const input = lastUser || extractText(messages[messages.length - 1]?.content) || "";
  return { input, context, history };
}

export class NlpCloudExecutor extends BaseExecutor {
  constructor() {
    super("nlpcloud", PROVIDERS.nlpcloud || { format: "openai" });
  }

  buildUrl(model, _stream, _urlIndex = 0, credentials = null) {
    const raw =
      credentials?.providerSpecificData?.baseUrl ||
      this.config.baseUrl ||
      DEFAULT_BASE;
    let base = String(raw).replace(/\/+$/, "");
    if (base.endsWith("/chatbot")) {
      base = base.replace(/\/[^/]+\/chatbot$/, "");
    }
    if (!base.endsWith("/v1/gpu") && base.endsWith("/v1")) base = `${base}/gpu`;
    if (!base.includes("/v1")) base = DEFAULT_BASE;
    const modelId = model || DEFAULT_MODEL;
    return `${base}/${encodeURIComponent(modelId)}/chatbot`;
  }

  buildHeaders(credentials) {
    const token = credentials?.apiKey || credentials?.accessToken || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    };
  }

  transformRequest(model, body) {
    const { input, context, history } = resolvePrompt(body?.messages);
    const out = { input };
    if (context) out.context = context;
    if (history.length) out.history = history;
    return out;
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null }) {
    const url = this.buildUrl(model, stream, 0, credentials);
    const headers = this.buildHeaders(credentials);
    const transformedBody = this.transformRequest(model, body);
    log?.debug?.("FETCH", `NLPCLOUD → ${url}`);

    const response = await proxyAwareFetch(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(transformedBody),
        signal,
      },
      proxyOptions
    );

    if (!response.ok) {
      return { response, url, headers, transformedBody };
    }

    // Normalize NLP Cloud JSON → OpenAI chat.completion
    const data = await response.json().catch(() => ({}));
    const content =
      data.response || data.generated_text || data.answer || data.output || "";
    const openai = {
      id: `chatcmpl-nlpcloud-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model || DEFAULT_MODEL,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: String(content) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    if (stream) {
      const id = openai.id;
      const sse =
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created: openai.created,
          model: openai.model,
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: String(content) },
              finish_reason: null,
            },
          ],
        })}\n\n` +
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created: openai.created,
          model: openai.model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        })}\n\n` +
        "data: [DONE]\n\n";
      return {
        response: new Response(sse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
        url,
        headers,
        transformedBody,
      };
    }

    return {
      response: new Response(JSON.stringify(openai), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      url,
      headers,
      transformedBody,
    };
  }
}

export default NlpCloudExecutor;
