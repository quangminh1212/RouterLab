import { describe, expect, it } from "vitest";
import { buildHandoffPayload, injectHandoffIntoBody } from "../../open-sse/services/contextHandoff.js";

describe("context handoff", () => {
  it("builds a compact handoff payload from recent messages", () => {
    const payload = buildHandoffPayload({
      sessionId: "sess-1",
      comboName: "relay-combo",
      fromAccount: "conn-1",
      provider: "openai",
      model: "gpt-4o-mini",
      body: {
        messages: [
          { role: "user", content: "Hãy sửa file src/app/api/test.js và giữ nguyên API." },
          { role: "assistant", content: "Đã phân tích route, sẽ vá tối thiểu." },
        ],
      },
    });

    expect(payload.sessionId).toBe("sess-1");
    expect(payload.comboName).toBe("relay-combo");
    expect(payload.fromAccount).toBe("conn-1");
    expect(payload.summary).toContain("user:");
    expect(payload.summary).toContain("assistant:");
    expect(payload.activeEntities).toContain("src/app/api/test.js");
  });

  it("injects handoff into a system message when switching account", () => {
    const nextBody = injectHandoffIntoBody(
      {
        messages: [{ role: "user", content: "Tiếp tục sửa bug." }],
      },
      {
        summary: "Đã sửa phần validate đầu vào.",
        taskProgress: "Đang chuyển sang account fallback để hoàn tất request.",
        keyDecisions: ["Giữ nguyên schema JSON"],
        activeEntities: ["src/sse/handlers/chat.js"],
      }
    );

    expect(nextBody._contextRelayInjected).toBe(true);
    expect(nextBody.messages[0].role).toBe("system");
    expect(nextBody.messages[0].content).toContain("<context_handoff>");
    expect(nextBody.messages[0].content).toContain("Giữ nguyên schema JSON");
  });
});
