const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_BINDINGS = 10000;

class SessionAffinityStore {
  constructor(ttlMs = DEFAULT_TTL_MS, maxSize = MAX_BINDINGS) {
    this._store = new Map();
    this._ttlMs = ttlMs;
    this._maxSize = maxSize;
    this._cleanup = setInterval(() => this._evictExpired(), 60000);
    if (this._cleanup.unref) this._cleanup.unref();
  }

  get(sessionId, provider) {
    if (!sessionId) return null;
    const key = `${provider}::${sessionId}`;
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.lastUsed > this._ttlMs) {
      this._store.delete(key);
      return null;
    }
    entry.lastUsed = Date.now();
    return entry.connectionId;
  }

  bind(sessionId, provider, connectionId) {
    if (!sessionId || !connectionId) return;
    const key = `${provider}::${sessionId}`;
    if (this._store.size >= this._maxSize && !this._store.has(key)) {
      const oldest = this._store.keys().next().value;
      this._store.delete(oldest);
    }
    this._store.set(key, { connectionId, lastUsed: Date.now() });
  }

  unbind(sessionId, provider) {
    if (!sessionId) return;
    this._store.delete(`${provider}::${sessionId}`);
  }

  _evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now - entry.lastUsed > this._ttlMs) this._store.delete(key);
    }
  }

  get size() { return this._store.size; }
}

export const sessionAffinityStore = new SessionAffinityStore();
