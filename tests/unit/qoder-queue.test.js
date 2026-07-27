/**
 * Qoder queue/busy error parsing + SSE inspect path.
 */
import { describe, it, expect } from "vitest";
import {
  parseQoderErrorBody,
  formatQoderErrorMessage,
  mapQoderError,
  qoderQueueResetsAtMs,
} from "../../open-sse/shared/qoder/errors.js";
import { __test__ as qoderInternals } from "../../open-sse/executors/qoder.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

const NESTED_QUEUE_BODY = JSON.stringify({
  code: "403",
  message: JSON.stringify({
    code: "10605",
    message: JSON.stringify({
      isQueued: true,
      modelKey: "qmodel_preview",
      queueCount: 36,
      queueType: "slow",
      serviceAvailable: true,
    }),
  }),
});

describe("parseQoderErrorBody", () => {
  it("unwraps nested 10605 queue payload", () => {
    const info = parseQoderErrorBody(NESTED_QUEUE_BODY);
    expect(info.isQueued).toBe(true);
    expect(info.code).toBe("10605");
    expect(info.modelKey).toBe("qmodel_preview");
    expect(info.queueCount).toBe(36);
    expect(info.queueType).toBe("slow");
  });

  it("treats code 10605 alone as queued", () => {
    const info = parseQoderErrorBody(JSON.stringify({ code: "10605", message: "busy" }));
    expect(info.isQueued).toBe(true);
  });

  it("does not mark plain 403 as queued", () => {
    const info = parseQoderErrorBody(JSON.stringify({ code: "403", message: "forbidden" }));
    expect(info.isQueued).toBe(false);
  });
});

describe("formatQoderErrorMessage / mapQoderError", () => {
  it("formats a clear queue message", () => {
    const info = parseQoderErrorBody(NESTED_QUEUE_BODY);
    const msg = formatQoderErrorMessage(info, 403);
    expect(msg).toContain("qmodel_preview");
    expect(msg).toContain("queue #36");
    expect(msg).toContain("slow");
    expect(msg).not.toContain("isQueued");
  });

  it("maps queue to HTTP 429 with resetsAtMs", () => {
    const mapped = mapQoderError(403, NESTED_QUEUE_BODY);
    expect(mapped.status).toBe(429);
    expect(mapped.isQueued).toBe(true);
    expect(mapped.resetsAtMs).toBeGreaterThan(Date.now());
    expect(mapped.message).toMatch(/busy \(queue #36/);
  });

  it("queue cooldown scales with queue depth", () => {
    const shallow = qoderQueueResetsAtMs({ isQueued: true, queueCount: 1 });
    const deep = qoderQueueResetsAtMs({ isQueued: true, queueCount: 100 });
    expect(deep - Date.now()).toBeGreaterThan(shallow - Date.now());
  });
});

describe("accountFallback + queue message", () => {
  it("triggers backoff fallback for friendly queue text", () => {
    const mapped = mapQoderError(403, NESTED_QUEUE_BODY);
    const result = checkFallbackError(mapped.status, mapped.message, 0);
    expect(result.shouldFallback).toBe(true);
    expect(result.cooldownMs).toBeGreaterThan(0);
  });
});

describe("inspectAndWrapQoderSSE queue envelope", () => {
  const { inspectAndWrapQoderSSE } = qoderInternals;

  function makeSseResponse(events) {
    const body = events.map((e) => `data: ${e}\n\n`).join("");
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  it("converts first-event queue envelope to 429 JSON (not content dump)", async () => {
    const envelope = JSON.stringify({
      statusCodeValue: 403,
      body: NESTED_QUEUE_BODY,
    });
    const res = await inspectAndWrapQoderSSE(makeSseResponse([envelope]), "qoder/qmodel_preview");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.message).toMatch(/qmodel_preview/);
    expect(json.error.message).toMatch(/queue #36/);
    expect(json.error.message).not.toMatch(/isQueued/);
    expect(json.error.type).toBe("rate_limit_error");
  });

  it("passes through successful envelope as stream", async () => {
    const inner = JSON.stringify({
      id: "x",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content: "hi" }, finish_reason: null }],
    });
    const envelope = JSON.stringify({ statusCodeValue: 200, body: inner });
    const res = await inspectAndWrapQoderSSE(makeSseResponse([envelope]), "qoder/auto");
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("hi");
    expect(text).not.toContain("statusCodeValue");
  });
});
