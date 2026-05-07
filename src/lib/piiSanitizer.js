// PII Sanitizer - Protect sensitive information in logs and responses

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const API_KEY_REGEX = /\b(sk-[a-zA-Z0-9]{20,}|[a-f0-9]{32,64})\b/gi;
const TOKEN_REGEX = /\b(Bearer\s+[A-Za-z0-9\-._~+\/]+=*)\b/gi;
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const CREDIT_CARD_REGEX = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

/**
 * Mask email addresses
 * Example: user@example.com -> u***@e***.com
 */
function maskEmail(email) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  
  const maskedLocal = local.length > 2 
    ? local[0] + "*".repeat(Math.min(local.length - 1, 5))
    : local[0] + "*";
  
  const domainParts = domain.split(".");
  const maskedDomain = domainParts.map((part, i) => {
    if (i === domainParts.length - 1) return part; // Keep TLD
    return part[0] + "*".repeat(Math.min(part.length - 1, 3));
  }).join(".");
  
  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask API keys and tokens
 * Example: sk-1234567890abcdef -> sk-***cdef
 */
function maskApiKey(key) {
  if (key.length <= 8) return "***";
  return key.substring(0, 3) + "***" + key.substring(key.length - 4);
}

/**
 * Mask Bearer tokens
 */
function maskToken(token) {
  const parts = token.split(" ");
  if (parts.length === 2) {
    return `${parts[0]} ***${parts[1].substring(parts[1].length - 4)}`;
  }
  return "Bearer ***";
}

/**
 * Mask IP addresses (keep first octet)
 * Example: 192.168.1.1 -> 192.*.*.*
 */
function maskIP(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.*.*.*`;
}

/**
 * Mask phone numbers
 * Example: +1-234-567-8900 -> +1-***-***-8900
 */
function maskPhone(phone) {
  return phone.replace(/(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/, "***-***-$3");
}

/**
 * Mask credit card numbers
 * Example: 1234-5678-9012-3456 -> ****-****-****-3456
 */
function maskCreditCard(card) {
  return card.replace(/(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})/, "****-****-****-$4");
}

/**
 * Sanitize a string by masking all PII
 */
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  
  let sanitized = str;
  
  // Mask emails
  sanitized = sanitized.replace(EMAIL_REGEX, (match) => maskEmail(match));
  
  // Mask API keys
  sanitized = sanitized.replace(API_KEY_REGEX, (match) => maskApiKey(match));
  
  // Mask Bearer tokens
  sanitized = sanitized.replace(TOKEN_REGEX, (match) => maskToken(match));
  
  // Mask IPs (but keep localhost)
  sanitized = sanitized.replace(IP_REGEX, (match) => {
    if (match === "127.0.0.1" || match === "0.0.0.0") return match;
    return maskIP(match);
  });
  
  // Mask phone numbers
  sanitized = sanitized.replace(PHONE_REGEX, (match) => maskPhone(match));
  
  // Mask credit cards
  sanitized = sanitized.replace(CREDIT_CARD_REGEX, (match) => maskCreditCard(match));
  
  return sanitized;
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj, maxDepth = 10, currentDepth = 0) {
  if (currentDepth >= maxDepth) return obj;
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sensitive keys that should be completely masked
      const sensitiveKeys = [
        "password", "apiKey", "api_key", "secret", "token", 
        "accessToken", "access_token", "refreshToken", "refresh_token",
        "authorization", "cookie", "session"
      ];
      
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        sanitized[key] = "***REDACTED***";
      } else {
        sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Sanitize log arguments
 */
function sanitizeLogArgs(...args) {
  return args.map((arg) => {
    if (typeof arg === "string") {
      return sanitizeString(arg);
    }
    if (typeof arg === "object") {
      return sanitizeObject(arg);
    }
    return arg;
  });
}

/**
 * Wrap console methods to auto-sanitize
 */
function enableAutoSanitization() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  
  console.log = function(...args) {
    originalLog.apply(console, sanitizeLogArgs(...args));
  };
  
  console.error = function(...args) {
    originalError.apply(console, sanitizeLogArgs(...args));
  };
  
  console.warn = function(...args) {
    originalWarn.apply(console, sanitizeLogArgs(...args));
  };
  
  console.info = function(...args) {
    originalInfo.apply(console, sanitizeLogArgs(...args));
  };
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeLogArgs,
  enableAutoSanitization,
  maskEmail,
  maskApiKey,
  maskToken,
  maskIP,
  maskPhone,
  maskCreditCard,
};
