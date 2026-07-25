import { DefaultExecutor } from "./default.js";

/**
 * Tencent CodeBuddy CN — forces stream + optional reasoning_summary.
 * OmniRoute: open-sse/executors/codebuddy-cn.ts
 */
export class CodeBuddyCnExecutor extends DefaultExecutor {
  constructor() {
    super("codebuddy-cn");
  }

  transformRequest(model, body, stream, credentials) {
    const transformed = super.transformRequest(model, body, stream, credentials);
    if (!transformed || typeof transformed !== "object" || Array.isArray(transformed)) {
      return transformed;
    }
    const out = { ...transformed, stream: true };

    const eff = out.reasoning_effort;
    if (eff === "none" || eff === "off") {
      delete out.reasoning_effort;
    } else if (eff) {
      out.reasoning_summary = "auto";
    }
    return out;
  }
}

export default CodeBuddyCnExecutor;
