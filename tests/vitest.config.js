import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.js"],
    maxWorkers: 1,
    fileParallelism: false,
    silent: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/app/api/v1/api/chat/route.js",
        "src/app/api/v1/audio/speech/route.js",
        "src/app/api/v1/audio/transcriptions/route.js",
        "src/app/api/v1/messages/route.js",
        "src/app/api/v1/messages/count_tokens/route.js",
        "src/app/api/v1/models/route.js",
        "src/app/api/v1/models/info/route.js",
        "src/app/api/v1/moderations/route.js",
        "src/app/api/v1/rerank/route.js",
        "src/app/api/v1/responses/compact/route.js",
        "src/app/api/v1beta/models/route.js",
        "src/app/health/route.js",
        "src/sse/services/requestDedup.js",
        "open-sse/handlers/embeddingsCore.js",
        "open-sse/utils/claudeHeaderCache.js",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      // Resolve open-sse/* imports to the actual local package
      "open-sse": resolve(__dirname, "../open-sse"),
      "@": resolve(__dirname, "../src"),
    },
  },
});

