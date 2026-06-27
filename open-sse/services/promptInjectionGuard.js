// Prompt Injection Guard — lightweight heuristic-based detection.
// Scans user messages for common prompt injection patterns.
// Configurable: block, warn, or log mode.

const INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|prompts?)/i,
  // Role hijacking
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /new\s+system\s+prompt/i,
  /override\s+system\s+(message|prompt|instructions?)/i,
  // Delimiter escape attempts
  /\]\]\s*>\s*system/i,
  /<\/?system>/i,
  /```\s*(system|prompt|instructions?)\s*\n/i,
  // Jailbreak patterns
  /\bDAN\b.*\bmode\b/i,
  /do\s+anything\s+now/i,
  /developer\s+mode\s+(enabled|activated|on)/i,
  // Output manipulation
  /pretend\s+(you|that)\s+(are|have)\s+no\s+(rules|restrictions|limitations)/i,
  /act\s+as\s+if\s+(you\s+)?(have|had)\s+no\s+(guidelines|rules|restrictions)/i,
];

const SEVERITY_WEIGHTS = {
  directOverride: 3,
  roleHijack: 2,
  delimiterEscape: 3,
  jailbreak: 2,
  outputManipulation: 1,
};

/**
 * Scan text for prompt injection patterns.
 * @param {string} text - Text to scan
 * @returns {{ detected: boolean, score: number, matches: string[] }}
 */
export function scanForInjection(text) {
  if (!text || typeof text !== "string") return { detected: false, score: 0, matches: [] };

  const matches = [];
  let score = 0;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern)?.[0] || "";
      matches.push(match.slice(0, 80));
      score += 2;
    }
  }

  return { detected: score >= 2, score, matches };
}

/**
 * Guard middleware for chat requests.
 * @param {object} body - Request body with messages
 * @param {object} options - { mode: "block"|"warn"|"log", threshold: number }
 * @returns {{ allowed: boolean, warning?: string, details?: object }}
 */
export function checkPromptInjection(body, options = {}) {
  const { mode = "warn", threshold = 2 } = options;
  const messages = body?.messages || body?.input || [];

  if (!Array.isArray(messages)) return { allowed: true };

  let totalScore = 0;
  const allMatches = [];

  for (const msg of messages) {
    if (msg?.role === "system") continue; // Don't scan system messages

    const content = typeof msg?.content === "string"
      ? msg.content
      : Array.isArray(msg?.content)
        ? msg.content.filter(p => p?.type === "text").map(p => p.text).join("\n")
        : "";

    if (!content) continue;

    const { score, matches } = scanForInjection(content);
    totalScore += score;
    allMatches.push(...matches);
  }

  const detected = totalScore >= threshold;

  if (!detected) return { allowed: true };

  const details = { score: totalScore, patterns: allMatches.slice(0, 5) };

  if (mode === "block") {
    return { allowed: false, warning: "Potential prompt injection detected", details };
  }

  // warn and log modes: allow but flag
  return { allowed: true, warning: "Potential prompt injection detected (allowed in warn mode)", details };
}
