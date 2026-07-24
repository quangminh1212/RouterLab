/**
 * Redis RESP-compatible usage queue (CLIProxyAPI parity).
 *
 * Optional in-process TCP server that speaks a minimal RESP subset so external
 * tools can SUBSCRIBE to usage/error channels without a real Redis.
 *
 * Enable with env:
 *   REDIS_USAGE_QUEUE_PORT=6379   (or any free port)
 *   REDIS_USAGE_QUEUE_RETENTION_SECONDS=3600
 *
 * Channels:
 *   usage  — chat/token usage events (JSON strings)
 *   error  — upstream/proxy error events
 */
import net from "net";

const log = {
  info: (tag, msg) => console.log(`[${tag}] ${msg}`),
  warn: (tag, msg) => console.warn(`[${tag}] ${msg}`),
  debug: () => {},
};

const DEFAULT_RETENTION_MS = Math.max(
  60_000,
  (Number(process.env.REDIS_USAGE_QUEUE_RETENTION_SECONDS) || 3600) * 1000,
);

const state = {
  server: null,
  port: null,
  clients: new Set(),
  channels: {
    usage: new Set(),
    error: new Set(),
  },
  history: {
    usage: [],
    error: [],
  },
};

function encodeSimple(str) {
  return `+${str}\r\n`;
}

function encodeError(str) {
  return `-${str}\r\n`;
}

function encodeBulk(str) {
  if (str == null) return "$-1\r\n";
  const buf = Buffer.from(String(str), "utf8");
  return `$${buf.length}\r\n${buf.toString("utf8")}\r\n`;
}

function encodeArray(items) {
  let out = `*${items.length}\r\n`;
  for (const item of items) {
    if (Array.isArray(item)) out += encodeArray(item);
    else if (item == null) out += "$-1\r\n";
    else out += encodeBulk(item);
  }
  return out;
}

function pushHistory(channel, payload) {
  const list = state.history[channel];
  if (!list) return;
  list.push({ at: Date.now(), payload });
  const cutoff = Date.now() - DEFAULT_RETENTION_MS;
  while (list.length && list[0].at < cutoff) list.shift();
  // hard cap
  while (list.length > 10_000) list.shift();
}

function publishToSubscribers(channel, payload) {
  const subs = state.channels[channel];
  if (!subs || subs.size === 0) return 0;
  const msg = encodeArray(["message", channel, payload]);
  let n = 0;
  for (const socket of subs) {
    if (socket.destroyed) {
      subs.delete(socket);
      continue;
    }
    try {
      socket.write(msg);
      n += 1;
    } catch {
      subs.delete(socket);
    }
  }
  return n;
}

/**
 * Publish a usage event (safe no-op when server disabled).
 * @param {object} event
 */
export function publishUsageEvent(event) {
  try {
    const payload = JSON.stringify({
      type: "usage",
      ts: new Date().toISOString(),
      ...event,
    });
    pushHistory("usage", payload);
    publishToSubscribers("usage", payload);
  } catch (e) {
    log.debug?.("REDIS_USAGE", `publish usage failed: ${e.message}`);
  }
}

/**
 * Publish an error event.
 * @param {object} event
 */
export function publishErrorEvent(event) {
  try {
    const payload = JSON.stringify({
      type: "error",
      ts: new Date().toISOString(),
      ...event,
    });
    pushHistory("error", payload);
    publishToSubscribers("error", payload);
  } catch (e) {
    log.debug?.("REDIS_USAGE", `publish error failed: ${e.message}`);
  }
}

function handleCommand(socket, args) {
  if (!args.length) return;
  const cmd = String(args[0] || "").toUpperCase();

  if (cmd === "PING") {
    socket.write(args[1] != null ? encodeBulk(args[1]) : encodeSimple("PONG"));
    return;
  }
  if (cmd === "ECHO") {
    socket.write(encodeBulk(args[1] ?? ""));
    return;
  }
  if (cmd === "SUBSCRIBE") {
    const channels = args.slice(1).map((c) => String(c).toLowerCase());
    let i = 0;
    for (const ch of channels) {
      if (!state.channels[ch]) state.channels[ch] = new Set();
      state.channels[ch].add(socket);
      socket._respSubs = socket._respSubs || new Set();
      socket._respSubs.add(ch);
      i += 1;
      socket.write(encodeArray(["subscribe", ch, String(i)]));
    }
    return;
  }
  if (cmd === "UNSUBSCRIBE") {
    const channels = args.length > 1
      ? args.slice(1).map((c) => String(c).toLowerCase())
      : [...(socket._respSubs || [])];
    for (const ch of channels) {
      state.channels[ch]?.delete(socket);
      socket._respSubs?.delete(ch);
      socket.write(encodeArray(["unsubscribe", ch, String(socket._respSubs?.size || 0)]));
    }
    return;
  }
  if (cmd === "PUBLISH") {
    const ch = String(args[1] || "").toLowerCase();
    const msg = args[2] ?? "";
    if (ch === "usage" || ch === "error") {
      pushHistory(ch, msg);
      const n = publishToSubscribers(ch, msg);
      socket.write(`:${n}\r\n`);
    } else {
      socket.write(encodeError("ERR unknown channel (use usage|error)"));
    }
    return;
  }
  if (cmd === "INFO") {
    const info = [
      "# Server",
      "redis_mode:xlabrouter-usage-queue",
      `connected_clients:${state.clients.size}`,
      `usage_history:${state.history.usage.length}`,
      `error_history:${state.history.error.length}`,
      `port:${state.port || 0}`,
    ].join("\r\n");
    socket.write(encodeBulk(info + "\r\n"));
    return;
  }
  if (cmd === "QUIT") {
    socket.write(encodeSimple("OK"));
    socket.end();
    return;
  }

  socket.write(encodeError(`ERR unknown command '${cmd}'`));
}

/**
 * Minimal RESP array parser for one or more commands in a buffer.
 * Supports *N\\r\\n$len\\r\\n... form used by redis-cli SUBSCRIBE/PING.
 */
function parseRespCommands(buffer) {
  const commands = [];
  let i = 0;
  const s = buffer.toString("utf8");
  while (i < s.length) {
    if (s[i] !== "*") {
      // inline command: PING\\r\\n
      const end = s.indexOf("\r\n", i);
      if (end < 0) break;
      const line = s.slice(i, end).trim();
      if (line) commands.push(line.split(/\s+/));
      i = end + 2;
      continue;
    }
    const hdrEnd = s.indexOf("\r\n", i);
    if (hdrEnd < 0) break;
    const n = Number(s.slice(i + 1, hdrEnd));
    if (!Number.isFinite(n) || n < 0) break;
    i = hdrEnd + 2;
    const args = [];
    let ok = true;
    for (let k = 0; k < n; k++) {
      if (s[i] !== "$") {
        ok = false;
        break;
      }
      const lenEnd = s.indexOf("\r\n", i);
      if (lenEnd < 0) {
        ok = false;
        break;
      }
      const len = Number(s.slice(i + 1, lenEnd));
      i = lenEnd + 2;
      if (!Number.isFinite(len) || i + len + 2 > s.length) {
        ok = false;
        break;
      }
      args.push(s.slice(i, i + len));
      i += len + 2;
    }
    if (!ok) break;
    commands.push(args);
  }
  return { commands, rest: Buffer.from(s.slice(i), "utf8") };
}

/**
 * Start the RESP usage queue server if REDIS_USAGE_QUEUE_PORT is set.
 * @returns {Promise<{port:number}|null>}
 */
export function startRedisUsageQueue(port = Number(process.env.REDIS_USAGE_QUEUE_PORT) || 0) {
  if (!port || port <= 0) return Promise.resolve(null);
  if (state.server) return Promise.resolve({ port: state.port });

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      state.clients.add(socket);
      let buf = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        const { commands, rest } = parseRespCommands(buf);
        buf = rest;
        for (const args of commands) handleCommand(socket, args);
      });
      socket.on("close", () => {
        state.clients.delete(socket);
        for (const ch of Object.keys(state.channels)) state.channels[ch].delete(socket);
      });
      socket.on("error", () => {
        state.clients.delete(socket);
      });
    });

    server.on("error", (err) => {
      log.warn("REDIS_USAGE", `failed to bind port ${port}: ${err.message}`);
      state.server = null;
      state.port = null;
      reject(err);
    });

    server.listen(port, "0.0.0.0", () => {
      state.server = server;
      state.port = port;
      log.info("REDIS_USAGE", `RESP usage queue listening on :${port} (channels: usage, error)`);
      resolve({ port });
    });
  });
}

export function stopRedisUsageQueue() {
  if (!state.server) return;
  for (const socket of state.clients) {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  }
  state.clients.clear();
  for (const ch of Object.keys(state.channels)) state.channels[ch].clear();
  state.server.close();
  state.server = null;
  state.port = null;
}

export function getRedisUsageQueueStatus() {
  return {
    enabled: !!state.server,
    port: state.port,
    clients: state.clients.size,
    usageHistory: state.history.usage.length,
    errorHistory: state.history.error.length,
    retentionMs: DEFAULT_RETENTION_MS,
  };
}
