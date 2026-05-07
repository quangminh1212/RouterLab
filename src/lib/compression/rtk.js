/**
 * RTK (Router Tool Kit) Compression Engine
 * Simplified version for command/tool output compression
 * Inspired by OmniRoute RTK patterns
 */

// Command output categories
const COMMAND_CATEGORIES = {
  git: [/\bgit\s+(status|branch|diff|log|show)\b/i],
  test: [/\b(npm|yarn|pnpm)\s+test\b/i, /\b(vitest|jest|pytest)\b/i, /\bcargo\s+test\b/i],
  build: [/\b(npm|yarn|pnpm)\s+run\s+build\b/i, /\b(tsc|webpack)\b/i, /\bvite\s+build\b/i, /\bcargo\s+build\b/i],
  package: [/\b(npm|yarn|pnpm|pip)\s+install\b/i, /\bcargo\s+add\b/i],
  docker: [/\bdocker\s+(ps|logs|build)\b/i],
  shell: [/^\s*(ls|find|grep|cat)\b/im],
};

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  maxLines: 120,
  maxChars: 12000,
  deduplicateThreshold: 3,
  preserveErrors: true,
  stripAnsi: true,
};

/**
 * Strip ANSI escape codes
 */
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Detect command category from text
 */
function detectCommandCategory(text) {
  const lower = text.toLowerCase();

  for (const [category, patterns] of Object.entries(COMMAND_CATEGORIES)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return category;
      }
    }
  }

  // Check for common output patterns
  if (/FAIL|PASS|Test Suites|Tests:/i.test(text)) return "test";
  if (/error|warning|failed/i.test(text)) return "error";
  if (/\+\+\+|---|@@/i.test(text)) return "git";

  return "generic";
}

/**
 * Check if line contains error/warning
 */
function isImportantLine(line) {
  const lower = line.toLowerCase();
  return (
    lower.includes("error") ||
    lower.includes("fail") ||
    lower.includes("warning") ||
    lower.includes("✗") ||
    lower.includes("✓") ||
    lower.includes("pass") ||
    /^\s*at\s+/.test(line) || // Stack trace
    /^\s*\d+\s*\|/.test(line) // Code line numbers
  );
}

/**
 * Deduplicate repeated lines
 */
function deduplicateLines(lines, threshold) {
  const result = [];
  const counts = new Map();
  let lastLine = null;
  let repeatCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === lastLine) {
      repeatCount++;
      if (repeatCount === threshold) {
        result.push(`  ... (repeated ${threshold}+ times)`);
      }
    } else {
      if (repeatCount > 0 && repeatCount < threshold) {
        // Add the remaining repeats
        for (let i = 0; i < repeatCount; i++) {
          result.push(line);
        }
      }
      result.push(line);
      lastLine = trimmed;
      repeatCount = 0;
    }
  }

  return result;
}

/**
 * Compress git output
 */
function compressGit(text) {
  const lines = text.split("\n");
  const result = [];

  for (const line of lines) {
    // Keep status indicators
    if (/^\s*(modified|new file|deleted|renamed|On branch|Changes|Untracked)/i.test(line)) {
      result.push(line);
      continue;
    }

    // Keep diff headers
    if (/^(diff|index|---|\+\+\+|@@)/i.test(line)) {
      result.push(line);
      continue;
    }

    // Skip verbose git advice
    if (/^\s*\(use "git/.test(line)) continue;

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Compress test output
 */
function compressTest(text) {
  const lines = text.split("\n");
  const result = [];

  for (const line of lines) {
    // Keep test results
    if (/^\s*(PASS|FAIL|Test Suites|Tests:|✓|✗)/i.test(line)) {
      result.push(line);
      continue;
    }

    // Keep errors and stack traces
    if (isImportantLine(line)) {
      result.push(line);
      continue;
    }

    // Skip verbose test setup
    if (/^\s*(Determining test|Running|Collecting)/i.test(line)) continue;
  }

  return result.join("\n");
}

/**
 * Compress build output
 */
function compressBuild(text) {
  const lines = text.split("\n");
  const result = [];

  for (const line of lines) {
    // Keep errors and warnings
    if (isImportantLine(line)) {
      result.push(line);
      continue;
    }

    // Keep build summary
    if (/^\s*(Built|Compiled|Bundle|Output|Size)/i.test(line)) {
      result.push(line);
      continue;
    }

    // Skip progress indicators
    if (/^\s*(Building|Compiling|Bundling|\[\d+%\])/i.test(line)) continue;
  }

  return result.join("\n");
}

/**
 * Compress generic output
 */
function compressGeneric(text, config) {
  let lines = text.split("\n");

  // Deduplicate
  lines = deduplicateLines(lines, config.deduplicateThreshold);

  // Truncate if too long
  if (lines.length > config.maxLines) {
    const head = lines.slice(0, Math.floor(config.maxLines * 0.3));
    const tail = lines.slice(-Math.floor(config.maxLines * 0.3));
    const omitted = lines.length - head.length - tail.length;
    lines = [...head, `\n... (${omitted} lines omitted) ...\n`, ...tail];
  }

  return lines.join("\n");
}

/**
 * Compress tool/command output
 */
function compressOutput(text, config = DEFAULT_CONFIG) {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  // Strip ANSI codes
  if (config.stripAnsi) {
    result = stripAnsi(result);
  }

  // Detect category and apply specific compression
  const category = detectCommandCategory(result);

  switch (category) {
    case "git":
      result = compressGit(result);
      break;
    case "test":
      result = compressTest(result);
      break;
    case "build":
      result = compressBuild(result);
      break;
    default:
      result = compressGeneric(result, config);
  }

  // Final character limit
  if (result.length > config.maxChars) {
    const half = Math.floor(config.maxChars / 2);
    const head = result.slice(0, half);
    const tail = result.slice(-half);
    const omitted = result.length - config.maxChars;
    result = `${head}\n\n... (${omitted} chars omitted) ...\n\n${tail}`;
  }

  return result;
}

/**
 * Compress messages with RTK
 */
function compressMessages(body, config = DEFAULT_CONFIG) {
  if (!config.enabled || !body || !body.messages) {
    return body;
  }

  const compressedMessages = body.messages.map(msg => {
    // Only compress tool/function results
    if (msg.role !== "tool" && msg.role !== "function") {
      return msg;
    }

    // Compress string content
    if (typeof msg.content === "string") {
      return {
        ...msg,
        content: compressOutput(msg.content, config),
      };
    }

    // Compress array content
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map(part => {
          if (part.type === "text" && part.text) {
            return {
              ...part,
              text: compressOutput(part.text, config),
            };
          }
          return part;
        }),
      };
    }

    return msg;
  });

  return {
    ...body,
    messages: compressedMessages,
  };
}

/**
 * Calculate compression stats
 */
function calculateStats(original, compressed) {
  const originalLength = original.length;
  const compressedLength = compressed.length;
  const saved = originalLength - compressedLength;
  const ratio = originalLength > 0 ? (saved / originalLength) * 100 : 0;

  return {
    originalLength,
    compressedLength,
    saved,
    ratio: Math.round(ratio * 100) / 100,
  };
}

module.exports = {
  DEFAULT_CONFIG,
  compressOutput,
  compressMessages,
  calculateStats,
  detectCommandCategory,
};
