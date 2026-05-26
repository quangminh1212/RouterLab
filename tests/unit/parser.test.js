import { describe, it, expect } from "vitest";
import { parseUpstreamError } from "../../open-sse/utils/error.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

function makeResponse(body, status = 500, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType }
  });
}

describe("parseUpstreamError", () => {
  it("sanitizes known upstream HTML/text errors", async () => {
    const response = makeResponse(
      "An error occurred while processing your request. Please contact help.openai.com and include request ID abc123.",
      503,
      "text/plain"
    );

    const parsed = await parseUpstreamError(response);

    expect(parsed.statusCode).toBe(503);
    expect(parsed.isBadUpstream).toBe(true);
    expect(parsed.isRetryable).toBe(true);
    expect(parsed.message).not.toContain("help.openai.com");
    expect(parsed.message).not.toContain("request ID abc123");
  });

  it("keeps useful JSON error messages", async () => {
    const response = makeResponse(
      JSON.stringify({ error: { message: "Model not found" } }),
      404,
      "application/json"
    );

    const parsed = await parseUpstreamError(response);

    expect(parsed.statusCode).toBe(404);
    expect(parsed.message).toBe("Model not found");
    expect(parsed.isBadUpstream).toBe(false);
  });

  it("marks html upstream errors as bad upstream", async () => {
    const response = makeResponse(
      "<html><body><h1>Bad Gateway</h1></body></html>",
      502,
      "text/html"
    );

    const parsed = await parseUpstreamError(response);

    expect(parsed.statusCode).toBe(502);
    expect(parsed.isBadUpstream).toBe(true);
    expect(parsed.isRetryable).toBe(true);
    expect(parsed.message).not.toContain("<html>");
  });

  it("extracts resetsAtMs from Retry-After seconds header", async () => {
    const response = new Response(
      JSON.stringify({ error: { message: "Rate limit exceeded" } }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "120",
        },
      },
    );

    const now = Date.now();
    const parsed = await parseUpstreamError(response);

    expect(parsed.statusCode).toBe(429);
    expect(parsed.resetsAtMs).toBeGreaterThan(now + 110_000);
    expect(parsed.resetsAtMs).toBeLessThanOrEqual(now + 121_000);
  });

  it("extracts resetsAtMs from x-ratelimit-reset epoch header", async () => {
    const resetAtSec = Math.floor(Date.now() / 1000) + 90;
    const response = new Response(
      JSON.stringify({ error: { message: "Too many requests" } }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "x-ratelimit-reset": String(resetAtSec),
        },
      },
    );

    const parsed = await parseUpstreamError(response);

    expect(parsed.statusCode).toBe(429);
    expect(parsed.resetsAtMs).toBe(resetAtSec * 1000);
  });
});

describe("checkFallbackError", () => {
  it("does not fallback on unmatched client 400 errors", () => {
    const result = checkFallbackError(400, "input must be a string or array");
    expect(result.shouldFallback).toBe(false);
    expect(result.cooldownMs).toBe(0);
  });

  it("keeps fallback for explicit auth/quota statuses", () => {
    const unauthorized = checkFallbackError(401, "Invalid API key");
    const rateLimited = checkFallbackError(429, "Rate limit exceeded", 0);

    expect(unauthorized.shouldFallback).toBe(true);
    expect(unauthorized.cooldownMs).toBeGreaterThan(0);
    expect(rateLimited.shouldFallback).toBe(true);
    expect(rateLimited.cooldownMs).toBeGreaterThan(0);
  });

  it("falls back on unmatched upstream 5xx errors", () => {
    const result = checkFallbackError(500, "Unexpected upstream failure");
    expect(result.shouldFallback).toBe(true);
    expect(result.cooldownMs).toBeGreaterThan(0);
  });
});
