import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;

const CHAT_COMPLETIONS_TIMEOUT_MS = Number(process.env.CHAT_COMPLETIONS_TIMEOUT_MS) || 45000;
const OPENCLAW_CAPTURE_PROXY_ENABLED = process.env.OPENCLAW_CAPTURE_PROXY === "true";
const OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL || "https://api.xlabrnd.com/v1/chat/completions";

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

async function writeOpenClawCapture(stage, payload) {
  if (!OPENCLAW_CAPTURE_PROXY_ENABLED) return;
  const [{ promises: fs }, path, os] = await Promise.all([
    import("fs"),
    import("path"),
    import("os")
  ]);
  const rootDir = process.env.OPENCLAW_CAPTURE_DIR
    || path.join(process.cwd(), ".tmp-openclaw-capture");
  await fs.mkdir(rootDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}_${String(now.getMilliseconds()).padStart(3, "0")}`;
  const file = path.join(rootDir, `${stamp}_${stage}.json`);
  await fs.writeFile(file, JSON.stringify({
    hostname: os.hostname(),
    timestamp: now.toISOString(),
    stage,
    ...payload,
  }, null, 2), "utf8");
}

async function proxyOpenClawCapture(request) {
  const rawBody = await request.text();
  const inboundHeaders = Object.fromEntries(request.headers.entries());
  await writeOpenClawCapture("inbound", {
    method: request.method,
    url: request.url,
    headers: inboundHeaders,
    bodyText: rawBody,
  });

  const outboundHeaders = new Headers();
  for (const [key, value] of Object.entries(inboundHeaders)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length") continue;
    outboundHeaders.set(key, value);
  }

  const upstreamResponse = await fetch(OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL, {
    method: request.method,
    headers: outboundHeaders,
    body: rawBody,
    redirect: "manual",
  });

  const upstreamText = await upstreamResponse.text();
  await writeOpenClawCapture("upstream", {
    upstreamUrl: OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
    requestHeaders: Object.fromEntries(outboundHeaders.entries()),
    requestBodyText: rawBody,
    responseStatus: upstreamResponse.status,
    responseStatusText: upstreamResponse.statusText,
    responseHeaders: Object.fromEntries(upstreamResponse.headers.entries()),
    responseBodyText: upstreamText,
  });

  return new Response(upstreamText, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

async function postHandler(request) {
  if (OPENCLAW_CAPTURE_PROXY_ENABLED) {
    return proxyOpenClawCapture(request);
  }

  await ensureInitialized();
  return await handleChat(request);
}

export const POST = withRouteGuard(
  "v1/chat/completions",
  postHandler,
  { timeoutMs: CHAT_COMPLETIONS_TIMEOUT_MS },
);
