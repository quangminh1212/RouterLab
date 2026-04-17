/**
 * Simple logger utility for 9Router
 * Provides consistent logging format with timestamps
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function shouldLog(level) {
  return LOG_LEVELS[level] >= CURRENT_LOG_LEVEL;
}

function log(level, category, message, meta = null) {
  if (!shouldLog(level)) return;

  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level}] [${category}]`;
  
  if (meta) {
    console.log(`${prefix} ${message}`, meta);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (category, message, meta) => log('DEBUG', category, message, meta),
  info: (category, message, meta) => log('INFO', category, message, meta),
  warn: (category, message, meta) => log('WARN', category, message, meta),
  error: (category, message, meta) => log('ERROR', category, message, meta),
};

// CommonJS compatibility for MITM server
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { logger };
}
