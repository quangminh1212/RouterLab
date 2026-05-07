import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

function createAbortableHang() {
  return vi.fn((url, options = {}) => new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", () => {
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }, { once: true });
  }));
}

describe("gist backup timeouts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.XLAB_GIST_API_TIMEOUT_MS = "50";
    process.env.XLAB_GIST_RAW_TIMEOUT_MS = "50";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.XLAB_GIST_API_TIMEOUT_MS;
    delete process.env.XLAB_GIST_RAW_TIMEOUT_MS;
  });

  it("fails fast when GitHub Gist API listing hangs during backup", async () => {
    global.fetch = createAbortableHang();

    const { backupToGist } = await import("@/lib/gistBackup");

    await expect(backupToGist({
      token: "test-token",
      payload: { database: { settings: {} } },
    })).rejects.toThrow("GitHub Gist request timed out");
  });

  it("fails fast when downloading truncated Gist content hangs during restore", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          id: "gist-1",
          html_url: "https://gist.github.com/test/gist-1",
          updated_at: "2026-05-07T10:00:00.000Z",
          files: {
            "xlabrouter.backup.json": {
              truncated: true,
              raw_url: "https://gist.githubusercontent.com/raw/test",
            },
          },
        }),
      })
      .mockImplementationOnce(createAbortableHang());

    const { restoreFromGist } = await import("@/lib/gistBackup");

    await expect(restoreFromGist({
      token: "test-token",
      gistId: "gist-1",
      passphrases: ["test-token"],
    })).rejects.toThrow("Downloading full Gist backup timed out");
  });
});
