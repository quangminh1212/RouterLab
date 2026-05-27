import { describe, expect, it } from "vitest";
import { isInternallyStreamOnlyProvider } from "../../open-sse/handlers/chatCore.js";


describe("TamMao streaming compatibility", () => {
  it("forces cungcapai through the internal streaming path", () => {
    expect(isInternallyStreamOnlyProvider("cungcapai")).toBe(true);
  });

  it("does not force regular OpenAI-compatible providers", () => {
    expect(isInternallyStreamOnlyProvider("openrouter")).toBe(false);
  });
});