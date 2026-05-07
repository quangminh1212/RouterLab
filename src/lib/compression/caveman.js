/**
 * Caveman Compression Engine
 * Simplified version inspired by OmniRoute
 * "Why use many token when few token do trick?"
 */

// Compression intensity levels
const INTENSITY_LEVELS = {
  lite: "lite",
  full: "full",
  ultra: "ultra",
};

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  intensity: "full",
  compressRoles: ["user", "assistant"],
  minMessageLength: 50,
  preserveCodeBlocks: true,
  preserveUrls: true,
};

// Caveman compression rules
const COMPRESSION_RULES = {
  // Lite rules (always apply)
  lite: [
    // Remove pleasantries
    { pattern: /\b(sure|certainly|of course|happy to help|thanks|thank you|no problem)\b/gi, replacement: "" },
    // Remove hedging
    { pattern: /\b(it seems like|it appears that|i think that|i believe that|probably|possibly)\b/gi, replacement: "" },
    // Remove filler adverbs
    { pattern: /\b(basically|essentially|actually|literally|simply|currently)\b/gi, replacement: "" },
    // Remove redundant phrases
    { pattern: /\b(make sure|be sure to|it is important to|you should|remember to)\b/gi, replacement: "" },
  ],
  
  // Full rules (lite + more aggressive)
  full: [
    // Remove polite framing
    { pattern: /\b(please|kindly|could you please|would you please|can you please)\b/gi, replacement: "" },
    // Remove verbose instructions
    { pattern: /\b(provide a detailed|give me a comprehensive|write an in-depth|create a thorough)\b/gi, replacement: "" },
    // Remove filler phrases
    { pattern: /\b(i want to|i need to|i''d like to|i''m looking for)\b/gi, replacement: "" },
    // Remove greetings
    { pattern: /^(hi there|hello|good morning|hey|hi)[,!.\s]*/gi, replacement: "" },
    // Collapse whitespace
    { pattern: /\s{2,}/g, replacement: " " },
    // Remove excessive punctuation
    { pattern: /[!.]{2,}/g, replacement: "." },
  ],
  
  // Ultra rules (full + extreme compression)
  ultra: [
    // Abbreviate common words
    { pattern: /\bdatabase\b/gi, replacement: "DB" },
    { pattern: /\bconfiguration\b/gi, replacement: "config" },
    { pattern: /\bfunction\b/gi, replacement: "fn" },
    { pattern: /\brequest\b/gi, replacement: "req" },
    { pattern: /\bresponse\b/gi, replacement: "res" },
    { pattern: /\bauthentication\b/gi, replacement: "auth" },
    { pattern: /\bauthorization\b/gi, replacement: "authz" },
    { pattern: /\bimplementation\b/gi, replacement: "impl" },
    // Remove articles
    { pattern: /\b(a|an|the)\s+/gi, replacement: " " },
    // Remove conjunctions
    { pattern: /\b(and|or|but)\s+/gi, replacement: ", " },
  ],
};

/**
 * Extract and preserve code blocks and URLs
 */
function extractPreservedBlocks(text) {
  const preserved = [];
  let result = text;
  
  // Preserve code blocks
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    const index = preserved.length;
    preserved.push(match);
    return `__PRESERVED_${index}__`;
  });
  
  // Preserve inline code
  result = result.replace(/`[^`]+`/g, (match) => {
    const index = preserved.length;
    preserved.push(match);
    return `__PRESERVED_${index}__`;
  });
  
  // Preserve URLs
  result = result.replace(/https?:\/\/[^\s]+/g, (match) => {
    const index = preserved.length;
    preserved.push(match);
    return `__PRESERVED_${index}__`;
  });
  
  return { text: result, preserved };
}

/**
 * Restore preserved blocks
 */
function restorePreservedBlocks(text, preserved) {
  let result = text;
  preserved.forEach((block, index) => {
    result = result.replace(`__PRESERVED_${index}__`, block);
  });
  return result;
}

/**
 * Apply compression rules
 */
function applyRules(text, intensity) {
  let result = text;
  
  // Apply lite rules
  COMPRESSION_RULES.lite.forEach(rule => {
    result = result.replace(rule.pattern, rule.replacement);
  });
  
  // Apply full rules if intensity >= full
  if (intensity === "full" || intensity === "ultra") {
    COMPRESSION_RULES.full.forEach(rule => {
      result = result.replace(rule.pattern, rule.replacement);
    });
  }
  
  // Apply ultra rules if intensity === ultra
  if (intensity === "ultra") {
    COMPRESSION_RULES.ultra.forEach(rule => {
      result = result.replace(rule.pattern, rule.replacement);
    });
  }
  
  // Clean up extra whitespace
  result = result.replace(/\s{2,}/g, " ").trim();
  
  return result;
}

/**
 * Compress a single message
 */
function compressMessage(message, config = DEFAULT_CONFIG) {
  if (!message || typeof message !== "string") {
    return message;
  }
  
  // Skip if message is too short
  if (message.length < config.minMessageLength) {
    return message;
  }
  
  // Extract preserved blocks
  const { text, preserved } = extractPreservedBlocks(message);
  
  // Apply compression rules
  const compressed = applyRules(text, config.intensity);
  
  // Restore preserved blocks
  const result = restorePreservedBlocks(compressed, preserved);
  
  return result;
}

/**
 * Compress messages in a chat request
 */
function compressMessages(body, config = DEFAULT_CONFIG) {
  if (!config.enabled || !body || !body.messages) {
    return body;
  }
  
  const compressedMessages = body.messages.map(msg => {
    // Skip if role is not in compressRoles
    if (!config.compressRoles.includes(msg.role)) {
      return msg;
    }
    
    // Compress string content
    if (typeof msg.content === "string") {
      return {
        ...msg,
        content: compressMessage(msg.content, config),
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
              text: compressMessage(part.text, config),
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
  INTENSITY_LEVELS,
  DEFAULT_CONFIG,
  compressMessage,
  compressMessages,
  calculateStats,
};
