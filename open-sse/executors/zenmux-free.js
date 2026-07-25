import { randomUUID } from "crypto";
import { BaseExecutor } from "./base.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

/**
 * ZenMux Free cookie provider (Anthropic-compatible SSE).
 * OmniRoute: open-sse/executors/zenmux-free.ts
 */

const CHAT_URL = "https://zenmux.ai/api/anthropic/v1/messages";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

function normalizeCookie(raw) {
  return String(raw || "")
    .replace(/^cookie:\s*/i, "")
    .trim();
}

function extractCtoken(cookieStr) {
  const m = cookieStr.match(/ctoken=([^;]+)/);
  return m ? m[1] : "";
}

export class ZenmuxFreeExecutor extends BaseExecutor {
  constructor() {
    super("zenmux-free", { id: "zenmux-free", baseUrl: CHAT_URL, format: "claude" });
  }

  buildUrl() {
    return CHAT_URL;
  }

  async execute({ body, credentials, signal, stream: wantStream, log, proxyOptions = null }) {
    const bodyObj = body || {};
    const rawCookie = normalizeCookie(
      credentials?.apiKey || credentials?.accessToken || credentials?.providerSpecificData?.cookie
    );
    const ctoken = extractCtoken(rawCookie);
    if (!ctoken) {
      const err = JSON.stringify({
        error: {
          message:
            "ZenMux Free: ctoken not found in cookies. Export all cookies from zenmux.ai and paste as the credential.",
          type: "authentication_error",
        },
      });
      return {
        response: new Response(err, {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
        url: CHAT_URL,
        headers: {},
        transformedBody: bodyObj,
      };
    }

    const messages = Array.isArray(bodyObj.messages) ? bodyObj.messages : [];
    const modelId = bodyObj.model || "deepseek/deepseek-chat";
    const maxTokens = bodyObj.max_tokens || 4096;

    const userMessages = messages.filter((m) => m.role === "user");
    const sysMessages = messages.filter((m) => m.role === "system");
    const lastUser = userMessages[userMessages.length - 1];
    const userText =
      typeof lastUser?.content === "string"
        ? lastUser.content
        : JSON.stringify(lastUser?.content ?? "Hello");
    const sysText =
      sysMessages.length > 0
        ? typeof sysMessages[0].content === "string"
          ? sysMessages[0].content
          : JSON.stringify(sysMessages[0].content)
        : null;
    const fullText = sysText ? `${sysText}\n\n${userText}` : userText;

    const reqId = randomUUID().replace(/-/g, "");
    const anthropicBody = {
      model: modelId,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: [{ type: "text", text: fullText }] }],
      stream: true,
    };
    if (bodyObj.temperature !== undefined) anthropicBody.temperature = bodyObj.temperature;

    const url = new URL(CHAT_URL);
    url.searchParams.set("ctoken", ctoken);

    const reqHeaders = {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Accept: "text/event-stream",
      Origin: "https://zenmux.ai",
      Referer: "https://zenmux.ai/platform/chat",
      "anthropic-version": "2023-06-01",
      "chat-request-id": reqId,
      "x-zenmux-accept-processing": "true, true",
      "x-zenmux-apikey-source": "subscription",
    };
    if (rawCookie) reqHeaders.Cookie = rawCookie;

    log?.debug?.("FETCH", `ZENMUX-FREE → ${url}`);

    const upstream = await proxyAwareFetch(
      url.toString(),
      {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(anthropicBody),
        signal,
      },
      proxyOptions
    );

    // chatCore expects OpenAI SSE when source format is openai; leave Anthropic SSE
    // when wantStream — translator layer handles claude→openai when needed.
    void wantStream;
    return {
      response: upstream,
      url: url.toString(),
      headers: reqHeaders,
      transformedBody: anthropicBody,
    };
  }
}

export default ZenmuxFreeExecutor;
