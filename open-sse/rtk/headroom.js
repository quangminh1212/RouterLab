// Headroom integration: optional external compression proxy.
// When enabled, sends the request body to an external Headroom server
// (default http://localhost:8787/v1/compress) before routing to the provider.
// Fails open: if Headroom is unreachable, the original body is used.

const DEFAULT_HEADROOM_URL = "http://localhost:8787/v1/compress";
const HEADROOM_TIMEOUT_MS = 10000;

/**
 * Compress the request body via an external Headroom proxy.
 * @param {object} body - Request body (OpenAI or Claude format)
 * @param {object} options - { headroomUrl, model }
 * @returns {{ body: object, compressed: boolean, savedTokens: number }}
 */
export async function compressViaHeadroom(body, options = {}) {
  const url = options.headroomUrl || DEFAULT_HEADROOM_URL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEADROOM_TIMEOUT_MS);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: body.messages || body.input,
        model: options.model || body.model,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { body, compressed: false, savedTokens: 0, error: `Headroom returned ${res.status}` };
    }

    const result = await res.json();

    if (result.messages && Array.isArray(result.messages)) {
      const compressedBody = { ...body };
      if (body.messages) {
        compressedBody.messages = result.messages;
      } else if (body.input) {
        compressedBody.input = result.messages;
      }
      const savedTokens = result.saved_tokens || result.savedTokens || 0;
      return { body: compressedBody, compressed: true, savedTokens };
    }

    return { body, compressed: false, savedTokens: 0 };
  } catch (err) {
    // Fail open: return original body
    return { body, compressed: false, savedTokens: 0, error: err.message || "Headroom unreachable" };
  }
}

/**
 * Check if Headroom server is healthy.
 * @param {string} headroomUrl
 * @returns {Promise<{ available: boolean, version?: string }>}
 */
export async function checkHeadroomHealth(headroomUrl) {
  const baseUrl = (headroomUrl || DEFAULT_HEADROOM_URL).replace(/\/v1\/compress$/, "");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { available: true, version: data.version || "unknown" };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}
