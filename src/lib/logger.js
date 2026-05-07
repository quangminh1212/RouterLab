/**
 * Simple logger utility for xlabrouter
 * Provides consistent logging format with timestamps
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === "production"
  ? LOG_LEVELS.WARN
  : LOG_LEVELS.INFO;

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? DEFAULT_LOG_LEVEL
  : DEFAULT_LOG_LEVEL;

const DEFAULT_SLOW_MS = Number(process.env.DEBUG_DASHBOARD_SLOW_MS) > 0
  ? Number(process.env.DEBUG_DASHBOARD_SLOW_MS)
  : 150;

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function shouldLog(level) {
  return LOG_LEVELS[level] >= CURRENT_LOG_LEVEL;
}

function isDashboardPerfEnabled() {
  return process.env.DEBUG_DASHBOARD_PERF === "true";
}

function isDashboardPerfVerbose() {
  return process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true";
}

function getDashboardPerfSlowMs() {
  return DEFAULT_SLOW_MS;
}

function toTraceId(prefix = "trace") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function shouldLogDashboardPerf({ durationMs = 0, force = false, verbose = false } = {}) {
  if (force) return true;
  if (verbose && isDashboardPerfVerbose()) return true;
  if (durationMs >= getDashboardPerfSlowMs()) return true;
  return isDashboardPerfEnabled();
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

function dashboardPerf(level, category, message, meta = {}, options = {}) {
  if (!shouldLogDashboardPerf({
    durationMs: meta?.durationMs,
    force: options.force,
    verbose: options.verbose,
  })) {
    return;
  }

  log(level, category, message, meta);
}

export const logger = {
  debug: (category, message, meta) => log('DEBUG', category, message, meta),
  info: (category, message, meta) => log('INFO', category, message, meta),
  warn: (category, message, meta) => log('WARN', category, message, meta),
  error: (category, message, meta) => log('ERROR', category, message, meta),
  dashboardPerf: {
    debug: (category, message, meta, options) => dashboardPerf('DEBUG', category, message, meta, options),
    info: (category, message, meta, options) => dashboardPerf('INFO', category, message, meta, options),
    warn: (category, message, meta, options) => dashboardPerf('WARN', category, message, meta, options),
    error: (category, message, meta, options) => dashboardPerf('ERROR', category, message, meta, options),
    enabled: isDashboardPerfEnabled,
    verbose: isDashboardPerfVerbose,
    slowMs: getDashboardPerfSlowMs,
    traceId: toTraceId,
  },
};

// CommonJS compatibility for MITM server
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { logger };
}
