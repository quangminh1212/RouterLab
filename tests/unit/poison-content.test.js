import { describe, it, expect } from "vitest";
import {
  looksLikePoisonAssistantContent,
  extractContentFromOpenAIFragment,
  rejectPoisonStreamResponse,
} from "../../open-sse/shared/poisonContent.js";

const NESTED = `[qoder error 403: {"code":"403","message":"{\\"code\\":\\"10605\\",\\"message\\":\\"{\\\\\\"isQueued\\\\\\":true,\\\\\\"modelKey\\\\\\":\\\\\\"qmodel_preview\\\\\\",\\\\\\"queueCount\\\\\\":22,\\\\\\"queueType\\\\\\":\\\\\\"slow\\\\\\"}\\"}"}]`;

describe("looksLikePoisonAssistantContent", () => {
  it("flags classic qoder error dump", () => {
    expect(looksLikePoisonAssistantContent(NESTED)).toBe(true);
  });

  it("flags friendly queue message", () => {
    expect(
      looksLikePoisonAssistantContent(
        'Qoder model "qmodel_preview" is busy (queue #22, slow). Retry shortly or switch model.',
      ),
    ).toBe(true);
  });

  it("does not flag normal prose", () => {
    expect(looksLikePoisonAssistantContent("Audit xong 360 chương, tiếp tục sửa pad.")).toBe(false);
  });
});

describe("rejectPoisonStreamResponse", () => {
  it("converts poison SSE content to 429 JSON", async () => {
    const chunk = JSON.stringify({
      id: "x",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content: NESTED }, finish_reason: "stop" }],
    });
    const sse = `data: ${chunk}\n\ndata: [DONE]\n\n`;
    const res = await rejectPoisonStreamResponse(
      new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.message).toMatch(/qmodel_preview|queue|busy|10605|qoder/i);
  });

  it("passes through normal SSE", async () => {
    const chunk = JSON.stringify({
      id: "x",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content: "PONG" }, finish_reason: "stop" }],
    });
    const sse = `data: ${chunk}\n\ndata: [DONE]\n\n`;
    const res = await rejectPoisonStreamResponse(
      new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    );
    expect(res.ok).toBe(true);
    const text = await res.text();
    expect(text).toContain("PONG");
  });
});

describe("extractContentFromOpenAIFragment", () => {
  it("reads delta content from SSE lines", () => {
    const chunk = JSON.stringify({
      choices: [{ delta: { content: "hi" } }],
    });
    expect(extractContentFromOpenAIFragment(`data: ${chunk}\n\n`)).toBe("hi");
  });
});
