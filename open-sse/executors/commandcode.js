import { DefaultExecutor } from "./default.js";

/**
 * Command Code CLI gateway (OpenAI-compatible with stream preference).
 * OmniRoute: open-sse/executors/commandCode.ts (simplified)
 */
export class CommandCodeExecutor extends DefaultExecutor {
  constructor(provider = "commandcode") {
    super(provider);
  }

  transformRequest(model, body, stream, credentials) {
    const transformed = super.transformRequest(model, body, stream, credentials);
    if (!transformed || typeof transformed !== "object") return transformed;
    // Upstream often only supports streaming chat
    return { ...transformed, stream: stream !== false };
  }
}

export default CommandCodeExecutor;
