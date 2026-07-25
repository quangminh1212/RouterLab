import { DefaultExecutor } from "./default.js";

/**
 * GLM / GLM-CN / GLMT — Claude-compatible transport tweaks.
 * OmniRoute: open-sse/executors/glm.ts (simplified JS port)
 */
const GLM_THINKING_MODEL_PATTERN = /^glm-5\.(?:[2-9]|\d{2,})/i;
const GLM_THINKING_DEFAULT_MAX_TOKENS = 131072;

function parseGlm52Effort(model) {
  if (model === "glm-5.2-high") return { baseModel: "glm-5.2", effort: "high" };
  if (model === "glm-5.2-max") return { baseModel: "glm-5.2", effort: "max" };
  return null;
}

export class GlmExecutor extends DefaultExecutor {
  constructor(provider = "glm") {
    super(provider);
  }

  transformRequest(model, body, stream, credentials) {
    const transformed = super.transformRequest(model, body, stream, credentials);
    if (!transformed || typeof transformed !== "object") return transformed;
    const out = { ...transformed };

    const effort = parseGlm52Effort(model || out.model);
    if (effort) {
      out.model = effort.baseModel;
      if (!out.thinking) out.thinking = { type: "enabled" };
      // Map Claude-style effort for coding plan endpoints
      out.output_config = {
        ...(typeof out.output_config === "object" ? out.output_config : {}),
        effort: effort.effort,
      };
    }

    const modelId = String(out.model || model || "");
    if (GLM_THINKING_MODEL_PATTERN.test(modelId)) {
      if (out.max_tokens == null && out.max_completion_tokens == null) {
        out.max_tokens = GLM_THINKING_DEFAULT_MAX_TOKENS;
      }
    }

    return out;
  }
}

export default GlmExecutor;
