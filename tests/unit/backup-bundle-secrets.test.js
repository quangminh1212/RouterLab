import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExportDb = vi.fn();
const mockImportDb = vi.fn();
const mockGetSettings = vi.fn();
const mockExportUsageDb = vi.fn();
const mockImportUsageDb = vi.fn();
const mockImportRequestDetailsDb = vi.fn();
const mockApplyOutboundProxyEnv = vi.fn();

vi.mock("@/lib/localDb", () => ({
  exportDb: mockExportDb,
  importDb: mockImportDb,
  getSettings: mockGetSettings,
}));

vi.mock("@/lib/usageDb", () => ({
  exportUsageDb: mockExportUsageDb,
  importUsageDb: mockImportUsageDb,
}));

vi.mock("@/lib/requestDetailsDb", () => ({
  importRequestDetailsDb: mockImportRequestDetailsDb,
}));

vi.mock("@/lib/network/outboundProxy", () => ({
  applyOutboundProxyEnv: mockApplyOutboundProxyEnv,
}));

vi.mock("@/app/api/cli-tools/claude-settings/route", () => ({ getClaudeSettingsBackup: vi.fn(async () => ({})), restoreClaudeSettingsBackup: vi.fn(async () => {}) }));
vi.mock("@/app/api/cli-tools/codex-settings/route", () => ({ getCodexSettingsBackup: vi.fn(async () => ({})), restoreCodexSettingsBackup: vi.fn(async () => {}) }));
vi.mock("@/app/api/cli-tools/opencode-settings/route", () => ({ getOpenCodeSettingsBackup: vi.fn(async () => ({})), restoreOpenCodeSettingsBackup: vi.fn(async () => {}) }));
vi.mock("@/app/api/cli-tools/openclaw-settings/route", () => ({ getOpenClawSettingsBackup: vi.fn(async () => ({})), restoreOpenClawSettingsBackup: vi.fn(async () => {}) }));
vi.mock("@/app/api/cli-tools/droid-settings/route", () => ({ getDroidSettingsBackup: vi.fn(async () => ({})), restoreDroidSettingsBackup: vi.fn(async () => {}) }));
vi.mock("@/app/api/cli-tools/copilot-settings/route", () => ({ getCopilotSettingsBackup: vi.fn(async () => ({})), restoreCopilotSettingsBackup: vi.fn(async () => {}) }));

describe("backup bundle secret sanitization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExportUsageDb.mockResolvedValue({ history: [], metadata: {} });
    mockGetSettings.mockResolvedValue({});
  });

  it("removes gist backup tokens from exported settings", async () => {
    mockExportDb.mockResolvedValue({
      settings: {
        gistBackup: {
          enabled: true,
          token: "ghp_secret_token",
          refreshToken: "refresh_secret",
          githubLogin: "octocat",
          gistId: "gist-1",
          htmlUrl: "https://gist.github.com/octocat/gist-1",
          updatedAt: "2026-05-31T12:00:00.000Z",
          fileName: "xlabrouter.backup.json",
          tokenSource: "access-token",
        },
      },
      providers: [],
    });

    const { createBackupBundle } = await import("@/lib/backupBundle");
    const payload = await createBackupBundle();

    expect(payload.database.settings.gistBackup.token).toBe("");
    expect(payload.database.settings.gistBackup.refreshToken).toBe("");
    expect(payload.database.settings.gistBackup.githubLogin).toBe("octocat");
    expect(payload.database.settings.gistBackup.gistId).toBe("gist-1");
  });
});
