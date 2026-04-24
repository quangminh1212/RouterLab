import { describe, it, expect } from "vitest";
import { parseUpstreamError } from "../../open-sse/utils/error.js";

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
});
