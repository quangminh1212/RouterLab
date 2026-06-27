import fs from "node:fs";
import { EventEmitter } from "node:events";

const isCloud = typeof caches !== "undefined" || typeof caches === "object";

class ConfigWatcher extends EventEmitter {
  constructor() {
    super();
    this._watcher = null;
    this._debounceTimer = null;
    this._debounceMs = 500;
    this._watching = false;
  }

  start(filePath) {
    if (isCloud || this._watching) return;
    if (!filePath || !fs.existsSync(filePath)) return;

    try {
      this._watcher = fs.watch(filePath, (eventType) => {
        if (eventType === "change") this._debounced();
      });
      this._watcher.on("error", (err) => {
        console.warn("[ConfigWatcher] watch error:", err.message);
        this.stop();
      });
      this._watching = true;
    } catch (err) {
      console.warn("[ConfigWatcher] failed to start:", err.message);
    }
  }

  _debounced() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.emit("change");
    }, this._debounceMs);
  }

  stop() {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._watching = false;
  }

  get active() {
    return this._watching;
  }
}

export const configWatcher = new ConfigWatcher();
