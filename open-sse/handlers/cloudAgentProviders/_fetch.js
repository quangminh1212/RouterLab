export function getKey(credentials) {
  return credentials?.accessToken || credentials?.apiKey || "";
}

export function normalizeStatus(status) {
  if (!status) return "working";
  const s = String(status).toLowerCase();
  if (s.includes("complete") || s === "done" || s === "succeeded") return "completed";
  if (s.includes("fail") || s.includes("error")) return "failed";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("submitted") || s.includes("pending") || s.includes("queued") || s.includes("created")) return "submitted";
  return "working";
}

export async function fetchJson(url, init, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json = {};
    if (text) {
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
    }
    if (!res.ok) throw new Error(json?.error?.message || json?.message || json?.detail || `HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}
