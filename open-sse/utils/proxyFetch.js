import { Readable } from "stream";
import { MEMORY_CONFIG, NETWORK_GUARD_CONFIG } from "../config/runtimeConfig.js";

const isCloud = typeof caches !== "undefined" && typeof caches === "object";

const originalFetch = globalThis.fetch;
const proxyDispatchers = new Map();

// DNS cache ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â use Map to avoid prototype pollution via malformed hostnames
const DNS_CACHE = new Map();
const MITM_BYPASS_HOSTS = [
  "cloudcode-pa.googleapis.com",
  "daily-cloudcode-pa.googleapis.com",
  "api.individual.githubcopilot.com",
  "q.us-east-1.amazonaws.com",
  "codewhisperer.us-east-1.amazonaws.com",
  "api2.cursor.sh",
];
const GOOGLE_DNS_SERVERS = ["8.8.8.8", "8.8.4.4"];
const HTTPS_PORT = 443;
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 300;

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/**
 * Resolve real IP using Google DNS (bypass system DNS)
 */
async function resolveRealIP(hostname) {
  const cached = DNS_CACHE.get(hostname);
  if (cached && Date.now() < cached.expiry) return cached.ip;

  try {
    const dns = await import("dns");
    const { promisify } = await import("util");
    const resolver = new dns.Resolver();
    resolver.setServers(GOOGLE_DNS_SERVERS);
    const resolve4 = promisify(resolver.resolve4.bind(resolver));
    const addresses = await resolve4(hostname);
    DNS_CACHE.set(hostname, { ip: addresses[0], expiry: Date.now() + MEMORY_CONFIG.dnsCacheTtlMs });
    return addresses[0];
  } catch (error) {
    console.warn(`[ProxyFetch] DNS resolve failed for ${hostname}:`, error.message);
    return null;
  }
}

/**
 * Check if request should bypass MITM DNS redirect
 */
function shouldBypassMitmDns(url) {
  try {
    const hostname = new URL(url).hostname;
    return MITM_BYPASS_HOSTS.some(host => hostname.includes(host));
  } catch { return false; }
}

function shouldBypassByNoProxy(targetUrl, noProxyValue) {
  const noProxy = normalizeString(noProxyValue);
  if (!noProxy) return false;

  let hostname;
  try { hostname = new URL(targetUrl).hostname.toLowerCase(); } catch { return false; }
  const patterns = noProxy.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);

  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.startsWith(".")) return hostname.endsWith(pattern) || hostname === pattern.slice(1);
    return hostname === pattern || hostname.endsWith(`.${pattern}`);
  });
}

/**
 * Get proxy URL from environment
 */
function getEnvProxyUrl(targetUrl) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (shouldBypassByNoProxy(targetUrl, noProxy)) return null;

  let protocol;
  try { protocol = new URL(targetUrl).protocol; } catch { return null; }

  if (protocol === "https:") {
    return process.env.HTTPS_PROXY || process.env.https_proxy ||
      process.env.ALL_PROXY || process.env.all_proxy;
  }

  return process.env.HTTP_PROXY || process.env.http_proxy ||
    process.env.ALL_PROXY || process.env.all_proxy;
}

/**
 * Normalize proxy URL (allow host:port)
 */
function normalizeProxyUrl(proxyUrl) {
  const normalizedInput = normalizeString(proxyUrl);
  if (!normalizedInput) return null;

  try {

    new URL(normalizedInput);
    return normalizedInput;
  } catch {
    // Allow "127.0.0.1:7890" style values
    return `http://${normalizedInput}`;
  }
}

function resolveConnectionProxyUrl(targetUrl, proxyOptions) {
  const enabled = proxyOptions?.enabled === true || proxyOptions?.connectionProxyEnabled === true;
  if (!enabled) return null;

  const proxyUrlRaw = normalizeString(proxyOptions?.url ?? proxyOptions?.connectionProxyUrl);
  if (!proxyUrlRaw) return null;

  const noProxy = normalizeString(proxyOptions?.noProxy ?? proxyOptions?.connectionNoProxy);
  if (noProxy && shouldBypassByNoProxy(targetUrl, noProxy)) return null;

  return normalizeProxyUrl(proxyUrlRaw);
}

/**
 * Create proxy dispatcher lazily (undici-compatible)
 */
async function getDispatcher(proxyUrl) {
  const normalized = normalizeProxyUrl(proxyUrl);
  if (!normalized) return null;

  if (!proxyDispatchers.has(normalized)) {
    // Evict oldest entry if max size reached
    if (proxyDispatchers.size >= MEMORY_CONFIG.proxyDispatchersMaxSize) {
      proxyDispatchers.delete(proxyDispatchers.keys().next().value);
    }
    const { ProxyAgent } = await import("undici");
    proxyDispatchers.set(normalized, new ProxyAgent({ uri: normalized }));
  }

  return proxyDispatchers.get(normalized);
}

/**
 * Create HTTPS request with manual socket connection (bypass DNS)
 */
async function createBypassRequest(parsedUrl, realIP, options) {
  const httpsModule = await import("https");
  const netModule = await import("net");
  // CJS modules expose exports via .default in ESM dynamic import context
  const https = httpsModule.default ?? httpsModule;
  const net = netModule.default ?? netModule;
  const abortSignal = options?.signal;

  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      const abortError = new Error("Fetch aborted");
      abortError.name = "AbortError";
      reject(abortError);
      return;
    }

    const socket = new net.Socket();
    let req;
    let settled = false;

    const cleanupAbortListener = () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onAbort);
      }
    };

    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      cleanupAbortListener();
      resolve(value);
    };

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      cleanupAbortListener();
      reject(error);
    };

    function onAbort() {
      const abortError = new Error("Fetch aborted");
      abortError.name = "AbortError";
      if (req) req.destroy(abortError);
      socket.destroy(abortError);
      rejectOnce(abortError);
    }

    if (abortSignal) {
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    socket.connect(HTTPS_PORT, realIP, () => {
      const reqOptions = {
        socket,
        servername: parsedUrl.hostname,
        rejectUnauthorized: false,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || "POST",
        headers: {
          ...options.headers,
          Host: parsedUrl.hostname,
        },
      };

      req = https.request(reqOptions, (res) => {
        const response = {
          ok: res.statusCode >= HTTP_SUCCESS_MIN && res.statusCode < HTTP_SUCCESS_MAX,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: new Map(Object.entries(res.headers)),
          body: Readable.toWeb(res),
          text: async () => {
            const chunks = [];
            for await (const chunk of res) chunks.push(chunk);
            return Buffer.concat(chunks).toString();
          },
          json: async () => JSON.parse(await response.text()),
        };
        resolveOnce(response);
      });

      req.on("error", rejectOnce);
      if (options.body) {
        req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });

    socket.on("error", rejectOnce);
  });
}

function mergeAbortSignals(primarySignal, secondarySignal) {
  const hasPrimary = primarySignal && typeof primarySignal.addEventListener === "function";
  const hasSecondary = secondarySignal && typeof secondarySignal.addEventListener === "function";

  if (!hasPrimary && !hasSecondary) {
    return { signal: undefined, cleanup: () => {} };
  }

  if (hasPrimary && !hasSecondary) {
    return { signal: primarySignal, cleanup: () => {} };
  }

  if (!hasPrimary && hasSecondary) {
    return { signal: secondarySignal, cleanup: () => {} };
  }

  const mergedController = new AbortController();

  const abortFrom = (sourceSignal) => {
    if (mergedController.signal.aborted) return;
    if (sourceSignal.reason !== undefined) {
      mergedController.abort(sourceSignal.reason);
      return;
    }
    mergedController.abort();
  };

  const onPrimaryAbort = () => abortFrom(primarySignal);
  const onSecondaryAbort = () => abortFrom(secondarySignal);

  if (primarySignal.aborted) {
    abortFrom(primarySignal);
  } else {
    primarySignal.addEventListener("abort", onPrimaryAbort, { once: true });
  }

  if (secondarySignal.aborted) {
    abortFrom(secondarySignal);
  } else {
    secondarySignal.addEventListener("abort", onSecondaryAbort, { once: true });
  }

  return {
    signal: mergedController.signal,
    cleanup: () => {
      primarySignal.removeEventListener("abort", onPrimaryAbort);
      secondarySignal.removeEventListener("abort", onSecondaryAbort);
    },
  };
}

function withFetchTimeout(requestFactory, options, timeoutMs) {
  const timeoutController = new AbortController();
  const { signal, cleanup } = mergeAbortSignals(options?.signal, timeoutController.signal);

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(`Fetch timeout after ${timeoutMs}ms`);
      timeoutError.name = "FetchTimeoutError";
      timeoutController.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  const requestOptions = signal ? { ...options, signal } : options;
  const requestPromise = Promise.resolve().then(() => requestFactory(requestOptions));

  return Promise.race([requestPromise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
    cleanup();
  });
}

export async function proxyAwareFetch(url, options = {}, proxyOptions = null) {
  const targetUrl = typeof url === "string" ? url : url.toString();
  const acceptHeader = typeof options.headers?.get === "function"
    ? options.headers.get("accept")
    : options.headers?.Accept || options.headers?.accept || "";
  const isStreaming = String(acceptHeader || "").includes("text/event-stream");
  const timeoutMs =
    options._fetchTimeout ||
    (isStreaming
      ? NETWORK_GUARD_CONFIG.streamingFetchTimeoutMs
      : NETWORK_GUARD_CONFIG.defaultFetchTimeoutMs);

  if (targetUrl.includes("api.xlabrnd.com")) {
    const headers = options.headers || {};
    if (typeof headers.set === "function") {
      headers.set("User-Agent", "OpenClaw/2026.4.27");
    } else {
      headers["User-Agent"] = "OpenClaw/2026.4.27";
      delete headers["user-agent"];
    }
    options = { ...options, headers };
  }

  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.hostname === "api.anthropic.com" && !isStreaming) {
      try {
        const { gotScraping } = await import(/* webpackIgnore: true */ "got-scraping");
        const response = await gotScraping({
          url: targetUrl,
          method: options.method || "GET",
          headers: options.headers,
          body: options.body,
          timeout: { request: timeoutMs },
          responseType: "buffer",
          throwHttpErrors: false,
          https: { rejectUnauthorized: false },
        });
        return new Response(response.rawBody, {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: response.headers,
        });
      } catch {
        // Fall back to native fetch when got-scraping is unavailable or fails.
      }
    }
  } catch {}

  // Vercel relay: forward request via relay headers
  const vercelRelayUrl = normalizeString(proxyOptions?.vercelRelayUrl);
  if (vercelRelayUrl) {
    const parsed = new URL(targetUrl);
    const relayHeaders = {
      ...options.headers,
      "x-relay-target": `${parsed.protocol}//${parsed.host}`,
      "x-relay-path": `${parsed.pathname}${parsed.search}`,
    };
    const relayOptions = { ...options, headers: relayHeaders };
    return withFetchTimeout(
      (effectiveOptions) => originalFetch(vercelRelayUrl, effectiveOptions),
      relayOptions,
      timeoutMs,
    );
  }

  const connectionProxyUrl = resolveConnectionProxyUrl(targetUrl, proxyOptions);
  const envProxyUrl = connectionProxyUrl ? null : normalizeProxyUrl(getEnvProxyUrl(targetUrl));
  const proxyUrl = connectionProxyUrl || envProxyUrl;

  // MITM DNS bypass: for known MITM-intercepted hosts, resolve real IP to avoid DNS spoof
  if (shouldBypassMitmDns(targetUrl)) {
    if (proxyUrl) {
      // Proxy resolves DNS externally (not affected by /etc/hosts) ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â use proxy directly
      try {
        const dispatcher = await getDispatcher(proxyUrl);
        const proxyFetchOptions = { ...options, dispatcher };
        return await withFetchTimeout(
          (effectiveOptions) => originalFetch(url, effectiveOptions),
          proxyFetchOptions,
          timeoutMs,
        );
      } catch (proxyError) {
        if (proxyOptions?.strictProxy === true) {
          throw new Error(`[ProxyFetch] Proxy required but failed (strictProxy=true): ${proxyError.message}`);
        }
        console.warn(`[ProxyFetch] Proxy failed, falling back to direct bypass: ${proxyError.message}`);
      }
    }
    // No proxy ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â manually resolve real IP to bypass DNS spoof
    try {
      const parsedUrl = new URL(targetUrl);
      const realIP = await resolveRealIP(parsedUrl.hostname);
      if (realIP) {
        return await withFetchTimeout(
          (effectiveOptions) => createBypassRequest(parsedUrl, realIP, effectiveOptions),
          options,
          timeoutMs,
        );
      }
    } catch (error) {
      console.warn(`[ProxyFetch] MITM bypass failed: ${error.message}`);
    }
  }

  if (proxyUrl) {
    try {
      const dispatcher = await getDispatcher(proxyUrl);
      const proxyFetchOptions = { ...options, dispatcher };
      return await withFetchTimeout(
        (effectiveOptions) => originalFetch(url, effectiveOptions),
        proxyFetchOptions,
        timeoutMs,
      );
    } catch (proxyError) {
      // If strictProxy is enabled, fail hard instead of falling back to direct
      if (proxyOptions?.strictProxy === true) {
        throw new Error(`[ProxyFetch] Proxy required but failed (strictProxy=true): ${proxyError.message}`);
      }
      console.warn(`[ProxyFetch] Proxy failed, falling back to direct: ${proxyError.message}`);
      return withFetchTimeout(
        (effectiveOptions) => originalFetch(url, effectiveOptions),
        options,
        timeoutMs,
      );
    }
  }

  return withFetchTimeout(
    (effectiveOptions) => originalFetch(url, effectiveOptions),
    options,
    timeoutMs,
  );
}

/**
 * Patched global fetch with env-proxy support and MITM DNS bypass
 */
async function patchedFetch(url, options = {}) {
  return proxyAwareFetch(url, options, null);
}

// Idempotency guard ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â only patch once to avoid wrapping multiple times
if (!isCloud && globalThis.fetch !== patchedFetch) {
  globalThis.fetch = patchedFetch;
}

export default isCloud ? originalFetch : patchedFetch;
