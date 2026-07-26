/**
 * Parse Qoder error payloads.
 *
 * Upstream often nests JSON strings several levels deep, e.g.:
 *   {"code":"403","message":"{\"code\":\"10605\",\"message\":\"{\\\"isQueued\\\":true,...}\"}"}
 * Code 10605 + isQueued means the model is busy (queue), not an auth failure.
 */

const MAX_UNWRAP = 8;

/**
 * Repeatedly unwrap nested JSON string messages into a flat info object.
 * @param {string|object} raw
 * @returns {{
 *   isQueued: boolean,
 *   queueCount: number|null,
 *   queueType: string|null,
 *   modelKey: string|null,
 *   code: string|null,
 *   serviceAvailable: boolean|null,
 *   rawMessage: string
 * }}
 */
export function parseQoderErrorBody(raw) {
  const info = {
    isQueued: false,
    queueCount: null,
    queueType: null,
    modelKey: null,
    code: null,
    serviceAvailable: null,
    rawMessage: "",
  };

  let cur = raw;
  if (cur == null) return info;

  for (let depth = 0; depth < MAX_UNWRAP; depth++) {
    if (typeof cur === "object" && cur !== null) {
      mergeQoderFields(info, cur);
      if (typeof cur.message === "string" && looksLikeJson(cur.message)) {
        cur = cur.message;
        continue;
      }
      if (typeof cur.message === "object" && cur.message !== null) {
        cur = cur.message;
        continue;
      }
      if (info.rawMessage === "" && cur.message != null) {
        info.rawMessage = typeof cur.message === "string" ? cur.message : JSON.stringify(cur.message);
      }
      break;
    }

    if (typeof cur !== "string") {
      info.rawMessage = String(cur);
      break;
    }

    const trimmed = cur.trim();
    if (!trimmed) break;
    info.rawMessage = trimmed;

    if (!looksLikeJson(trimmed)) {
      // Maybe a JSON object is embedded inside a larger string
      const extracted = extractJsonObject(trimmed);
      if (extracted) {
        cur = extracted;
        continue;
      }
      break;
    }

    try {
      cur = JSON.parse(trimmed);
    } catch {
      break;
    }
  }

  // Code 10605 is the documented queue/busy business code
  if (info.code === "10605" || info.code === 10605) {
    info.isQueued = true;
  }

  return info;
}

function looksLikeJson(s) {
  const t = String(s).trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

function extractJsonObject(s) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function mergeQoderFields(info, obj) {
  if (!obj || typeof obj !== "object") return;
  if (obj.isQueued === true || obj.isQueued === "true") info.isQueued = true;
  if (obj.queueCount != null && Number.isFinite(Number(obj.queueCount))) {
    info.queueCount = Number(obj.queueCount);
  }
  if (typeof obj.queueType === "string" && obj.queueType) info.queueType = obj.queueType;
  if (typeof obj.modelKey === "string" && obj.modelKey) info.modelKey = obj.modelKey;
  if (obj.code != null && obj.code !== "") info.code = String(obj.code);
  if (obj.serviceAvailable === true || obj.serviceAvailable === false) {
    info.serviceAvailable = obj.serviceAvailable;
  }
  // Nested data / result bags sometimes used by gateways
  if (obj.data && typeof obj.data === "object") mergeQoderFields(info, obj.data);
  if (obj.result && typeof obj.result === "object") mergeQoderFields(info, obj.result);
}

/**
 * Human-readable message for clients + account-fallback text rules.
 * @param {ReturnType<typeof parseQoderErrorBody>} info
 * @param {number} [statusVal]
 * @returns {string}
 */
export function formatQoderErrorMessage(info, statusVal = 0) {
  if (info?.isQueued) {
    const model = info.modelKey || "unknown";
    const n = info.queueCount != null ? info.queueCount : "?";
    const qtype = info.queueType || "queue";
    return `Qoder model "${model}" is busy (queue #${n}, ${qtype}). Retry shortly or switch model.`;
  }

  if (info?.rawMessage && !looksLikeJson(info.rawMessage)) {
    return info.rawMessage;
  }

  if (info?.code) {
    return `Qoder error ${info.code}${statusVal ? ` (HTTP ${statusVal})` : ""}`;
  }

  if (statusVal) return `Qoder upstream status ${statusVal}`;
  return "Qoder upstream error";
}

/**
 * Cooldown for queue/busy errors. Scales lightly with queue depth, capped.
 * @param {ReturnType<typeof parseQoderErrorBody>} info
 * @returns {number|undefined} epoch ms when retry is reasonable, or undefined
 */
export function qoderQueueResetsAtMs(info) {
  if (!info?.isQueued) return undefined;
  const n = Number.isFinite(info.queueCount) ? Math.max(0, info.queueCount) : 10;
  // ~2s per position, min 15s, max 4 min
  const cooldownMs = Math.min(4 * 60 * 1000, Math.max(15_000, 5_000 + n * 2_000));
  return Date.now() + cooldownMs;
}

/**
 * Map Qoder envelope / HTTP body to chatCore-friendly parseError result.
 * Queue → 429 so account fallback uses backoff, not auth refresh.
 * @param {number} statusVal
 * @param {string} bodyText
 * @returns {{ status: number, message: string, resetsAtMs?: number, isQueued: boolean }}
 */
export function mapQoderError(statusVal, bodyText) {
  const info = parseQoderErrorBody(bodyText);
  const message = formatQoderErrorMessage(info, statusVal);

  if (info.isQueued) {
    return {
      status: 429,
      message,
      resetsAtMs: qoderQueueResetsAtMs(info),
      isQueued: true,
    };
  }

  // Real auth/permission 403 stays 403
  const status = statusVal || 502;
  return { status, message, isQueued: false };
}
