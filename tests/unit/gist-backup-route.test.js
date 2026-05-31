import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFileAsync = vi.fn();
const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockBackupToGist = vi.fn();
const mockRestoreFromGist = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(() => mockExecFileAsync),
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
}));

vi.mock("@/lib/gistBackup", () => ({
  backupToGist: mockBackupToGist,
  restoreFromGist: mockRestoreFromGist,
}));

describe("gist backup route auth flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("stores gh-cli as token source when enabling GitHub CLI auth", async () => {
    mockGetSettings.mockResolvedValue({
      gistBackup: {
        enabled: false,
        token: "",
        tokenSource: "",
        githubLogin: "",
      },
    });
    mockExecFileAsync.mockResolvedValueOnce({ stdout: "gh-cli-token\n" });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: "octocat" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([]),
      });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "use-gh-cli" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      gistBackup: expect.objectContaining({
        token: "gh-cli-token",
        tokenSource: "gh-cli",
        githubLogin: "octocat",
      }),
    });
  });

  it("uses stored access token directly for backup without touching gh-cli", async () => {
    mockGetSettings.mockResolvedValue({
      gistBackup: {
        enabled: true,
        token: "manual-token",
        tokenSource: "access-token",
        githubLogin: "octocat",
        gistId: "gist-1",
      },
    });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: "octocat" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([]),
      });
    mockBackupToGist.mockResolvedValue({
      gistId: "gist-1",
      htmlUrl: "https://gist.github.com/octocat/gist-1",
      updatedAt: "2026-05-31T09:00:00.000Z",
    });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "backup" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecFileAsync).not.toHaveBeenCalled();
    expect(mockBackupToGist).toHaveBeenCalledWith(expect.objectContaining({
      token: "manual-token",
      gistId: "gist-1",
    }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      gistBackup: expect.objectContaining({
        token: "manual-token",
        tokenSource: "access-token",
        githubLogin: "octocat",
      }),
    });
  });

  it("rejects invalid stored access token instead of falling back to gh-cli", async () => {
    mockGetSettings.mockResolvedValue({
      gistBackup: {
        enabled: true,
        token: "stale-token",
        tokenSource: "access-token",
        githubLogin: "octocat",
        gistId: "gist-1",
      },
    });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "backup" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Stored GitHub access token is invalid");
    expect(mockExecFileAsync).not.toHaveBeenCalled();
    expect(mockBackupToGist).not.toHaveBeenCalled();
  });

  it("rejects invalid access token immediately on set-token", async () => {
    mockGetSettings.mockResolvedValue({ gistBackup: {} });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "set-token", token: "bad-token" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("GitHub access token is invalid");
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });


  it("rejects token that can read /user but cannot access Gist API", async () => {
    mockGetSettings.mockResolvedValue({ gistBackup: {} });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: "octocat" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: "Resource not accessible by personal access token" }),
      });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "set-token", token: "limited-token" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("missing gist scope");
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("rejects OAuth token prefix gho_ and asks for PAT", async () => {
    mockGetSettings.mockResolvedValue({ gistBackup: {} });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "set-token", token: "gho_example_token" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("prefix gho_");
    expect(body.error).toContain("ghp_");
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });


  it("fails fast when gh-cli source is unavailable and cached token is also invalid", async () => {
    mockGetSettings.mockResolvedValue({
      gistBackup: {
        enabled: true,
        token: "stale-cli-token",
        tokenSource: "gh-cli",
        githubLogin: "octocat",
        gistId: "gist-1",
      },
    });
    mockExecFileAsync.mockRejectedValueOnce(new Error("Cannot read GitHub CLI token"));
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    });

    const { POST } = await import("../../src/app/api/settings/gist-backup/route.js");
    const response = await POST({ json: async () => ({ action: "backup" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("cached token is no longer valid");
    expect(mockBackupToGist).not.toHaveBeenCalled();
  });
});
