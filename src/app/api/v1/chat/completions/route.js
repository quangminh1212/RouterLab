import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;

const CHAT_COMPLETIONS_TIMEOUT_MS = Number(process.env.CHAT_COMPLETIONS_TIMEOUT_MS) || 45000;
const OPENCLAW_CAPTURE_PROXY_ENABLED = process.env.OPENCLAW_CAPTURE_PROXY === "true";
const OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL || "https://api.xlabrnd.com/v1/chat/completions";
const OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS = Number(process.env.OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS) || 30000;

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

function shouldSkipHeader(key) {
  const lower = key.toLowerCase();
  return [
    "host",
    "content-length",
    "connection",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "cf-warp-tag-id",
    "cdn-loop",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
  ].includes(lower);
}

function isCaptureSelfLoop(request) {
  try {
    const incomingHost = new URL(request.url).host;
    const upstreamHost = new URL(OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL).host;
    return incomingHost.toLowerCase() === upstreamHost.toLowerCase();
  } catch {
    return false;
  }
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
    if (shouldSkipHeader(key)) continue;
    outboundHeaders.set(key, value);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS);

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL, {
      method: request.method,
      headers: outboundHeaders,
      body: rawBody,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    await writeOpenClawCapture("upstream-error", {
      upstreamUrl: OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
      requestHeaders: Object.fromEntries(outboundHeaders.entries()),
      requestBodyText: rawBody,
      errorName: error?.name,
      errorMessage: error?.message,
      timeoutMs: OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS,
    });

    const timedOut = error?.name === "AbortError";
    return new Response(JSON.stringify({
      error: {
        message: timedOut
          ? `OpenClaw upstream timed out after ${OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS}ms`
          : `OpenClaw upstream request failed: ${error?.message || "unknown error"}`,
        type: timedOut ? "timeout_error" : "server_error",
        code: timedOut ? "OPENCLAW_UPSTREAM_TIMEOUT" : "OPENCLAW_UPSTREAM_ERROR",
      },
    }), {
      status: timedOut ? 504 : 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

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
  if (OPENCLAW_CAPTURE_PROXY_ENABLED && !isCaptureSelfLoop(request)) {
    return proxyOpenClawCapture(request);
  }

  if (OPENCLAW_CAPTURE_PROXY_ENABLED && isCaptureSelfLoop(request)) {
    await writeOpenClawCapture("capture-bypass", {
      reason: "self-loop-detected",
      incomingUrl: request.url,
      upstreamUrl: OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
    });
  }

  await ensureInitialized();
  return await handleChat(request);
}

export const POST = withRouteGuard(
  "v1/chat/completions",
  postHandler,
  { timeoutMs: CHAT_COMPLETIONS_TIMEOUT_MS },
);
