import { describe, it, expect, vi, beforeEach } from "vitest";

const closeMock = vi.fn(async () => {});
const ProxyAgentMock = vi.fn(function ProxyAgentMock() {
  return { close: closeMock };
});
const fetchMock = vi.fn();

vi.mock("undici", () => ({
  ProxyAgent: ProxyAgentMock,
  fetch: fetchMock,
}));

describe("proxyTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 when proxyUrl missing", async () => {
    const { testProxyUrl } = await import("../../src/lib/network/proxyTest.js");
    await expect(testProxyUrl({ proxyUrl: "" })).resolves.toMatchObject({ ok: false, status: 400 });
  });

  it("returns 502 when proxy connection is refused", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED", message: "connect ECONNREFUSED" } }));
    const { testProxyUrl } = await import("../../src/lib/network/proxyTest.js");
    await expect(testProxyUrl({ proxyUrl: "http://127.0.0.1:65535", testUrl: "https://example.com" })).resolves.toMatchObject({ ok: false, status: 502 });
  });

  it("returns 504 on timeout abort", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const { testProxyUrl } = await import("../../src/lib/network/proxyTest.js");
    await expect(testProxyUrl({ proxyUrl: "http://127.0.0.1:65535", testUrl: "https://example.com", timeoutMs: 1 })).resolves.toMatchObject({ ok: false, status: 504 });
  });
});
