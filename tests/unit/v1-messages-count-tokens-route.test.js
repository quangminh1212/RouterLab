import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/v1/messages/count_tokens/route";

describe("/api/v1/messages/count_tokens", () => {
  it("returns standard error payload for invalid json", async () => {
    const response = await POST(new Request("http://localhost/api/v1/messages/count_tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Invalid JSON body",
        type: "invalid_request_error",
      },
    });
  });

  it("ignores malformed messages while counting text content", async () => {
    const response = await POST(new Request("http://localhost/api/v1/messages/count_tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          null,
          "bad",
          { role: "user", content: "1234" },
          { role: "assistant", content: [{ type: "text", text: "12345678" }, { type: "image", image_url: "x" }] },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      input_tokens: 3,
    });
  });
});
