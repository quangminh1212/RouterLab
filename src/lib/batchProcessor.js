// batchProcessor.js — executes an OpenAI-compatible batch by replaying each
// JSONL line through the local /v1/chat/completions endpoint, then writes the
// aggregated output back as a result file.
//
// Runs in-process (fire-and-forget). State transitions are persisted so the
// /v1/batches endpoints can report progress.
import {
  getBatch,
  updateBatch,
  getFileContent,
  setFileContent,
} from "@/lib/agentJobsDb.js";
import { getApiKeys } from "@/lib/localDb.js";

const SUPPORTED_ENDPOINTS = new Set(["/v1/chat/completions", "/v1/embeddings", "/v1/completions"]);
const MAX_CONCURRENCY = Math.max(1, Number(process.env.BATCH_MAX_CONCURRENCY) || 4);

function resolveBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 1212}`
  );
}

async function getInternalApiKey() {
  try {
    const keys = await getApiKeys();
    return keys.find((k) => k.isActive !== false)?.key || null;
  } catch {
    return null;
  }
}

function parseJsonl(text) {
  const lines = String(text || "").split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      rows.push({ __parseError: true, raw: trimmed.slice(0, 200) });
    }
  }
  return rows;
}

async function runOne(row, { baseUrl, apiKey, endpoint }) {
  const customId = row.custom_id || null;
  if (row.__parseError) {
    return {
      result: {
        id: `batch_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        custom_id: customId,
        response: null,
        error: { code: "invalid_json", message: "Malformed JSONL line" },
      },
      ok: false,
    };
  }

  const url = row.url && SUPPORTED_ENDPOINTS.has(row.url) ? row.url : endpoint;
  const method = (row.method || "POST").toUpperCase();
  const body = row.body || {};

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(`${baseUrl}/api${url}`, {
      method,
      headers,
      body: JSON.stringify({ ...body, stream: false }),
      signal: AbortSignal.timeout(Number(process.env.BATCH_REQUEST_TIMEOUT_MS) || 120000),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 2000) };
    }
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      result: {
        id: `batch_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        custom_id: customId,
        response: {
          status_code: res.status,
          request_id: res.headers.get("x-request-id") || null,
          body: parsed,
        },
        error: ok ? null : { code: `http_${res.status}`, message: "Upstream request failed" },
      },
    };
  } catch (err) {
    return {
      ok: false,
      result: {
        id: `batch_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        custom_id: customId,
        response: null,
        error: { code: "request_error", message: err?.message || "Request failed" },
      },
    };
  }
}

async function runPool(rows, worker) {
  const results = new Array(rows.length);
  let cursor = 0;
  async function next() {
    while (cursor < rows.length) {
      const index = cursor++;
      results[index] = await worker(rows[index], index);
    }
  }
  const pool = Array.from({ length: Math.min(MAX_CONCURRENCY, rows.length || 1) }, () => next());
  await Promise.all(pool);
  return results;
}

export async function processBatch(batchId) {
  const batch = await getBatch(batchId);
  if (!batch) return;

  // Cancelled before it began.
  if (batch.status === "cancelling" || batch.status === "cancelled") {
    await updateBatch(batchId, { status: "cancelled", cancelled_at: Math.floor(Date.now() / 1000) });
    return;
  }

  const endpoint = SUPPORTED_ENDPOINTS.has(batch.endpoint) ? batch.endpoint : "/v1/chat/completions";
  const inputText = await getFileContent(batch.input_file_id);

  if (inputText == null) {
    await updateBatch(batchId, {
      status: "failed",
      failed_at: Math.floor(Date.now() / 1000),
      errors: { object: "list", data: [{ code: "missing_input_file", message: "Input file not found" }] },
    });
    return;
  }

  const rows = parseJsonl(inputText);
  await updateBatch(batchId, {
    status: "in_progress",
    in_progress_at: Math.floor(Date.now() / 1000),
    request_counts: { total: rows.length, completed: 0, failed: 0 },
  });

  const baseUrl = resolveBaseUrl();
  const apiKey = await getInternalApiKey();

  let completed = 0;
  let failed = 0;
  const results = await runPool(rows, async (row) => {
    // Honor cancellation between requests.
    const current = await getBatch(batchId);
    if (current?.status === "cancelling" || current?.status === "cancelled") {
      return { ok: false, result: null, skipped: true };
    }
    const outcome = await runOne(row, { baseUrl, apiKey, endpoint });
    if (outcome.ok) completed++;
    else failed++;
    return outcome;
  });

  const current = await getBatch(batchId);
  if (current?.status === "cancelling") {
    await updateBatch(batchId, { status: "cancelled", cancelled_at: Math.floor(Date.now() / 1000) });
    return;
  }

  await updateBatch(batchId, { status: "finalizing", finalizing_at: Math.floor(Date.now() / 1000) });

  const outputLines = [];
  const errorLines = [];
  for (const r of results) {
    if (!r || r.skipped || !r.result) continue;
    if (r.ok) outputLines.push(JSON.stringify(r.result));
    else errorLines.push(JSON.stringify(r.result));
  }

  const outputFile = await setFileContent({
    filename: `${batchId}_output.jsonl`,
    purpose: "batch_output",
    content: outputLines.join("\n"),
  });

  let errorFileId = null;
  if (errorLines.length > 0) {
    const errorFile = await setFileContent({
      filename: `${batchId}_errors.jsonl`,
      purpose: "batch_output",
      content: errorLines.join("\n"),
    });
    errorFileId = errorFile.id;
  }

  await updateBatch(batchId, {
    status: "completed",
    completed_at: Math.floor(Date.now() / 1000),
    output_file_id: outputFile.id,
    error_file_id: errorFileId,
    request_counts: { total: rows.length, completed, failed },
  });
}

export function startBatchProcessing(batchId) {
  // Fire-and-forget; never block the request thread.
  Promise.resolve()
    .then(() => processBatch(batchId))
    .catch((err) => {
      console.error(`[batchProcessor] batch ${batchId} failed:`, err?.message || err);
      updateBatch(batchId, {
        status: "failed",
        failed_at: Math.floor(Date.now() / 1000),
        errors: { object: "list", data: [{ code: "internal_error", message: err?.message || "Processing failed" }] },
      }).catch(() => {});
    });
}
