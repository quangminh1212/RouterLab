import { describe, expect, it } from "vitest";
import { parseCockpitExport, summarizeEntries, toDateKey } from "@/lib/usage/cockpitImport";

describe("parseCockpitExport", () => {
  it("parses a record/event array (Shape A)", () => {
    const exportData = {
      exportedAt: "2026-05-20T10:00:00Z",
      usage: [
        { date: "2026-05-18", model: "claude-opus-4-6", provider: "antigravity", requests: 12, input_tokens: 1000, output_tokens: 500, cost: 0.42 },
        { date: "2026-05-19", model: "gemini-3.1-pro", requests: 5, promptTokens: 200, completionTokens: 100 },
        { date: "2026-05-19", model: "noise", requests: 0 }, // dropped (no usage)
      ],
    };
    const { entries, shape } = parseCockpitExport(exportData);
    expect(shape).toBe("records");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      dateKey: "2026-05-18",
      model: "claude-opus-4-6",
      provider: "antigravity",
      requests: 12,
      promptTokens: 1000,
      completionTokens: 500,
    });
    expect(entries[0].cost).toBeCloseTo(0.42);
  });

  it("parses a quota/model map (Shape B)", () => {
    const exportData = {
      models: {
        "claude-opus-4-6": { used: 30, resetTime: "2026-05-21T00:00:00Z" },
        "gemini-3-flash": { used: 8, input_tokens: 400 },
        "ignored": { used: 0 },
      },
    };
    const { entries, shape } = parseCockpitExport(exportData);
    expect(shape).toBe("quota");
    expect(entries).toHaveLength(2);
    const opus = entries.find((e) => e.model === "claude-opus-4-6");
    expect(opus.requests).toBe(30);
  });

  it("parses our own dailySummary re-export (Shape C)", () => {
    const exportData = {
      dailySummary: {
        "2026-05-18": {
          requests: 10, promptTokens: 1000, completionTokens: 500, cost: 0.5,
          byModel: {
            "claude-opus-4-6|antigravity": { requests: 10, promptTokens: 1000, completionTokens: 500, cost: 0.5, rawModel: "claude-opus-4-6", provider: "antigravity" },
          },
        },
      },
    };
    const { entries, shape } = parseCockpitExport(exportData);
    expect(shape).toBe("dailySummary");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ model: "claude-opus-4-6", provider: "antigravity", requests: 10 });
  });

  it("returns invalid for non-JSON string and unknown for empty object", () => {
    expect(parseCockpitExport("{not json").shape).toBe("invalid");
    expect(parseCockpitExport({ foo: "bar" }).shape).toBe("unknown");
  });

  it("accepts a top-level array", () => {
    const { entries, shape } = parseCockpitExport([
      { date: "2026-05-18", model: "m1", requests: 3 },
    ]);
    expect(shape).toBe("records");
    expect(entries).toHaveLength(1);
  });
});

describe("toDateKey", () => {
  it("passes through YYYY-MM-DD", () => {
    expect(toDateKey("2026-05-18")).toBe("2026-05-18");
  });
  it("handles unix seconds and ms", () => {
    const ms = Date.UTC(2026, 4, 18, 12, 0, 0);
    expect(toDateKey(ms)).toMatch(/^2026-05-\d{2}$/);
    expect(toDateKey(Math.floor(ms / 1000))).toMatch(/^2026-05-\d{2}$/);
  });
  it("falls back to provided date when unparseable", () => {
    const fb = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(toDateKey("garbage", fb)).toMatch(/^2026-01-01$/);
  });
});

describe("summarizeEntries", () => {
  it("totals across entries", () => {
    const totals = summarizeEntries([
      { dateKey: "2026-05-18", model: "a", requests: 2, promptTokens: 100, completionTokens: 50, cost: 0.1 },
      { dateKey: "2026-05-19", model: "b", requests: 3, promptTokens: 200, completionTokens: 60, cost: 0.2 },
    ]);
    expect(totals.requests).toBe(5);
    expect(totals.promptTokens).toBe(300);
    expect(totals.completionTokens).toBe(110);
    expect(totals.cost).toBeCloseTo(0.3);
    expect(totals.dayCount).toBe(2);
    expect(totals.modelCount).toBe(2);
  });
});
