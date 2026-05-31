import { describe, it, expect } from "vitest";
import {
  applyPayloadRules,
  getPath,
  setPath,
  deletePath,
  hasPath,
  normalizePayloadRules,
} from "../../open-sse/services/payloadRules.js";

describe("payloadRules path helpers", () => {
  it("gets nested and array paths", () => {
    const o = { a: { b: { c: 1 } }, arr: [{ x: 9 }] };
    expect(getPath(o, "a.b.c")).toBe(1);
    expect(getPath(o, "arr.0.x")).toBe(9);
    expect(getPath(o, "a.b.z")).toBeUndefined();
  });

  it("hasPath detects presence", () => {
    const o = { a: { b: 1 } };
    expect(hasPath(o, "a.b")).toBe(true);
    expect(hasPath(o, "a.c")).toBe(false);
  });

  it("setPath creates nested keys", () => {
    const o = {};
    setPath(o, "a.b.c", 5);
    expect(o.a.b.c).toBe(5);
  });

  it("deletePath removes keys", () => {
    const o = { a: { b: 1, c: 2 } };
    deletePath(o, "a.b");
    expect("b" in o.a).toBe(false);
    expect(o.a.c).toBe(2);
  });
});

describe("applyPayloadRules", () => {
  it("applies set/default/delete/rename for a matching rule", () => {
    const body = { model: "gpt-5.1", temperature: 1.5, frequency_penalty: 0.2, max_tokens: 100 };
    const rules = [
      {
        enabled: true,
        when: { provider: "openai", model: "gpt-5*" },
        actions: [
          { op: "set", path: "temperature", value: 0.7 },
          { op: "default", path: "top_p", value: 0.9 },
          { op: "delete", path: "frequency_penalty" },
          { op: "rename", path: "max_tokens", to: "max_completion_tokens" },
        ],
      },
    ];
    const res = applyPayloadRules(body, rules, { provider: "openai", model: "gpt-5.1", format: "openai" });
    expect(res.applied).toBe(1);
    expect(body.temperature).toBe(0.7);
    expect(body.top_p).toBe(0.9);
    expect("frequency_penalty" in body).toBe(false);
    expect(body.max_completion_tokens).toBe(100);
    expect("max_tokens" in body).toBe(false);
  });

  it("skips disabled and non-matching rules", () => {
    const body = { model: "claude-3", temperature: 1 };
    const rules = [
      { enabled: false, when: {}, actions: [{ op: "set", path: "temperature", value: 9 }] },
      { enabled: true, when: { provider: "openai" }, actions: [{ op: "set", path: "temperature", value: 0 }] },
    ];
    applyPayloadRules(body, rules, { provider: "anthropic", model: "claude-3" });
    expect(body.temperature).toBe(1);
  });

  it("honors pathEquals / pathMissing conditions", () => {
    const b1 = { stream: true };
    applyPayloadRules(b1, [{ enabled: true, when: { pathEquals: { path: "stream", value: true } }, actions: [{ op: "set", path: "marked", value: 1 }] }], {});
    expect(b1.marked).toBe(1);

    const b2 = { model: "x" };
    applyPayloadRules(b2, [{ enabled: true, when: { pathMissing: "reasoning" }, actions: [{ op: "set", path: "added", value: 1 }] }], {});
    expect(b2.added).toBe(1);
  });

  it("is a no-op for empty rules or non-object body", () => {
    expect(applyPayloadRules({}, [], {}).applied).toBe(0);
    expect(applyPayloadRules(null, [{ actions: [] }], {}).applied).toBe(0);
  });
});

describe("normalizePayloadRules", () => {
  it("keeps only valid rules and actions", () => {
    const norm = normalizePayloadRules([
      { actions: [{ op: "bogus", path: "x" }] },
      { actions: [{ op: "set", path: "y", value: 1 }] },
      "junk",
      { actions: [{ op: "delete" }] },
    ]);
    expect(norm.length).toBe(1);
    expect(norm[0].actions.length).toBe(1);
    expect(norm[0].enabled).toBe(true);
  });
});
