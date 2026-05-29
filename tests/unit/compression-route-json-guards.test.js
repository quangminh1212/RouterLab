import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/compression/route";

describe("compression route json guard", () => {
  it("POST /api/compression rejects invalid json", async () => {
    const response = await POST(new Request("http://localhost/api/compression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
