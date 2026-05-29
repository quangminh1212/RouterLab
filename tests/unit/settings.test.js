import { describe, it, expect, vi, beforeEach } from "vitest";

const files = new Map();
const dirs = new Set();

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

vi.mock("os", () => ({
  default: {
    homedir: vi.fn(() => "/mock/home"),
    platform: vi.fn(() => "linux"),
  },
  homedir: vi.fn(() => "/mock/home"),
  platform: vi.fn(() => "linux"),
}));

vi.mock("fs/promises", () => ({
  default: {
    access: vi.fn(async (target) => {
      if (!files.has(target) && !dirs.has(target)) {
        const error = new Error("ENOENT");
        error.code = "ENOENT";
        throw error;
      }
    }),
    readFile: vi.fn(async (target) => {
      if (!files.has(target)) {
        const error = new Error("ENOENT");
        error.code = "ENOENT";
        throw error;
      }
      return files.get(target);
    }),
    mkdir: vi.fn(async (target) => {
      dirs.add(target);
    }),
    writeFile: vi.fn(async (target, content) => {
      files.set(target, content);
    }),
  },
}));

vi.mock("child_process", () => ({
  exec: vi.fn((_command, _options, callback) => callback(new Error("not installed"), "", "")),
  execFile: vi.fn((_command, _args, _options, callback) => callback(null, "", "")),
}));

describe("Claude settings route", () => {
  beforeEach(() => {
    files.clear();
    dirs.clear();
    vi.clearAllMocks();
  });

  it("readSettings returns null for corrupt JSON instead of throwing", async () => {
    files.set("/mock/home/.claude/settings.json", "{broken-json");
    const { readSettings } = await import("../../src/app/api/cli-tools/claude-settings/route.js");

    await expect(readSettings()).resolves.toBeNull();
  });
});

