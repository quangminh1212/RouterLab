#!/usr/bin/env node
/**
 * compact-usage-store.mjs
 *
 * Reclaims disk space in the RouterLab data directory by:
 *   1. Re-compacting request-details.json (enforces per-field + total-size caps).
 *   2. Stripping the legacy `requestDetailsData` blob from db.json.
 *   3. Optionally pruning stale db.backup-* / db.*.json snapshot files.
 *
 * Safety:
 *   - Dry-run by default. Pass --apply to write changes.
 *   - Always writes a *.bak-<timestamp> copy before modifying a live file.
 *   - Backup pruning requires the explicit --prune-backups flag.
 *   - Stop the RouterLab process before running with --apply.
 *
 * Usage:
 *   node scripts/compact-usage-store.mjs               # report only (dry-run)
 *   node scripts/compact-usage-store.mjs --apply       # compact db.json + request-details.json
 *   node scripts/compact-usage-store.mjs --apply --prune-backups   # also remove old snapshots
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const APP_NAME = "xlabrouter";

// Keep in sync with src/lib/requestDetailsDb.js
const HARD_MAX_RECORDS = 200;
const HARD_MAX_JSON_SIZE = 64 * 1024; // 64KB per field
const MAX_TOTAL_DB_SIZE = 12 * 1024 * 1024; // 12MB total

function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(os.homedir(), `.${APP_NAME}`);
}

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const PRUNE_BACKUPS = args.has("--prune-backups");
const DATA_DIR = getDataDir();

// Backups created by this run — never prune these in the same invocation.
const sessionBackups = new Set();

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return "n/a";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function sizeOf(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function backupFile(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${file}.bak-${stamp}`;
  fs.copyFileSync(file, dest);
  sessionBackups.add(path.basename(dest));
  return dest;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function makeTruncatedField(value, originalSize) {
  let preview = "";
  try {
    preview = (typeof value === "string" ? value : JSON.stringify(value) || "").substring(0, 200);
  } catch {
    preview = "";
  }
  return { _truncated: true, _originalSize: originalSize, _preview: preview };
}

function compactRecord(record, maxSize) {
  const next = { ...record };
  for (const field of ["request", "providerRequest", "providerResponse", "response"]) {
    const value = next[field];
    if (value == null) continue;
    let rawSize = 0;
    try {
      rawSize = Buffer.byteLength(JSON.stringify(value) || "", "utf8");
    } catch {
      next[field] = { _truncated: true, _originalSize: -1, _preview: "" };
      continue;
    }
    if (rawSize > maxSize) next[field] = makeTruncatedField(value, rawSize);
  }
  return next;
}

function compactRecords(records, { maxRecords, maxJsonSize }) {
  let next = (Array.isArray(records) ? records : []).map((r) => compactRecord(r, maxJsonSize));
  next.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (next.length > maxRecords) next = next.slice(0, maxRecords);
  while (next.length > 1) {
    const totalSize = Buffer.byteLength(JSON.stringify({ records: next }), "utf8");
    if (totalSize <= MAX_TOTAL_DB_SIZE) break;
    next = next.slice(0, Math.floor(next.length / 2));
  }
  return next;
}

function compactRequestDetails() {
  const file = path.join(DATA_DIR, "request-details.json");
  if (!fs.existsSync(file)) {
    console.log("• request-details.json: not found (skip)");
    return 0;
  }
  const before = sizeOf(file);
  let data;
  try {
    data = readJson(file);
  } catch (e) {
    console.log(`• request-details.json: unreadable (${e.message}) — skipping`);
    return 0;
  }
  const records = Array.isArray(data?.records) ? data.records : [];
  const healed = compactRecords(records, { maxRecords: HARD_MAX_RECORDS, maxJsonSize: HARD_MAX_JSON_SIZE });
  const after = Buffer.byteLength(JSON.stringify({ records: healed }), "utf8");
  const saved = before - after;

  console.log(
    `• request-details.json: ${fmtBytes(before)} -> ~${fmtBytes(after)} ` +
      `(${records.length} -> ${healed.length} records, save ~${fmtBytes(saved)})`
  );

  if (APPLY && saved > 0) {
    const bak = backupFile(file);
    fs.writeFileSync(file, JSON.stringify({ records: healed }));
    console.log(`    applied. backup: ${path.basename(bak)}`);
  }
  return saved > 0 ? saved : 0;
}

function compactMainDb() {
  const file = path.join(DATA_DIR, "db.json");
  if (!fs.existsSync(file)) {
    console.log("• db.json: not found (skip)");
    return 0;
  }
  const before = sizeOf(file);
  let data;
  try {
    data = readJson(file);
  } catch (e) {
    console.log(`• db.json: unreadable (${e.message}) — skipping`);
    return 0;
  }

  let changed = false;
  // Legacy blob no longer used by current code; request details live in their own file.
  if (Object.prototype.hasOwnProperty.call(data, "requestDetailsData")) {
    delete data.requestDetailsData;
    changed = true;
  }

  if (!changed) {
    console.log(`• db.json: ${fmtBytes(before)} (no legacy blob, nothing to strip)`);
    return 0;
  }

  const after = Buffer.byteLength(JSON.stringify(data), "utf8");
  const saved = before - after;
  console.log(`• db.json: ${fmtBytes(before)} -> ~${fmtBytes(after)} (strip legacy requestDetailsData, save ~${fmtBytes(saved)})`);

  if (APPLY) {
    const bak = backupFile(file);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`    applied. backup: ${path.basename(bak)}`);
  }
  return saved;
}

function pruneBackups() {
  let entries = [];
  try {
    entries = fs.readdirSync(DATA_DIR);
  } catch {
    return 0;
  }
  // Match the recovery snapshots seen in the wild, but never the live files
  // nor backups this run just created.
  const isStaleSnapshot = (name) =>
    name !== "db.json" &&
    name !== "request-details.json" &&
    !sessionBackups.has(name) &&
    (/^db\.(backup-|merged-|restore-|vps-).*\.json$/.test(name) ||
      /^db\.json\.bak-/.test(name) ||
      /\.bak-\d/.test(name));

  const candidates = entries
    .filter(isStaleSnapshot)
    .map((name) => ({ name, size: sizeOf(path.join(DATA_DIR, name)) }))
    .sort((a, b) => b.size - a.size);

  if (candidates.length === 0) {
    console.log("• backups: none matched");
    return 0;
  }

  const total = candidates.reduce((s, c) => s + c.size, 0);
  console.log(`• backups: ${candidates.length} stale snapshot(s), total ${fmtBytes(total)}`);
  for (const c of candidates) console.log(`    ${c.name}  (${fmtBytes(c.size)})`);

  if (APPLY && PRUNE_BACKUPS) {
    for (const c of candidates) {
      fs.rmSync(path.join(DATA_DIR, c.name), { force: true });
    }
    console.log(`    removed ${candidates.length} file(s).`);
  } else if (!PRUNE_BACKUPS) {
    console.log("    (pass --prune-backups to remove these)");
  }
  return total;
}

/**
 * Prune the auto-generated runtime backup folder (backups/runtime), which is
 * written before tunnel operations and can accumulate into the gigabytes.
 * Keeps the newest `keep` snapshots.
 */
function pruneRuntimeBackups(keep = 10) {
  const dir = path.join(DATA_DIR, "backups", "runtime");
  if (!fs.existsSync(dir)) {
    console.log("• runtime backups: none");
    return 0;
  }
  const files = fs
    .readdirSync(dir)
    .map((name) => {
      const fp = path.join(dir, name);
      const stat = fs.statSync(fp);
      return { name, path: fp, mtime: stat.mtimeMs, size: stat.size };
    })
    .filter((f) => fs.statSync(f.path).isFile())
    .sort((a, b) => b.mtime - a.mtime);

  const total = files.reduce((s, f) => s + f.size, 0);
  const stale = files.slice(keep);
  const staleTotal = stale.reduce((s, f) => s + f.size, 0);

  console.log(
    `• runtime backups: ${files.length} file(s), ${fmtBytes(total)} ` +
      `(keep newest ${keep}, prune ${stale.length} = ${fmtBytes(staleTotal)})`
  );

  if (APPLY && PRUNE_BACKUPS) {
    for (const f of stale) {
      try { fs.rmSync(f.path, { force: true }); } catch { /* ignore */ }
    }
    if (stale.length) console.log(`    removed ${stale.length} runtime snapshot(s).`);
  } else if (!PRUNE_BACKUPS) {
    console.log("    (pass --prune-backups to prune these)");
  }
  return staleTotal;
}

function main() {
  console.log(`RouterLab — usage store compaction`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (report only)"}\n`);

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  if (APPLY) {
    console.log("⚠  Make sure the RouterLab process is stopped before applying.\n");
  }

  let saved = 0;
  saved += compactRequestDetails();
  saved += compactMainDb();
  const backupTotal = pruneBackups();
  const runtimeTotal = pruneRuntimeBackups(10);

  console.log("");
  console.log(`Reclaimable (compaction): ~${fmtBytes(saved)}`);
  console.log(`Reclaimable (stale backups): ~${fmtBytes(backupTotal + runtimeTotal)}`);
  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to compact live files.");
    if (backupTotal + runtimeTotal > 0) console.log("Add --prune-backups to also delete stale snapshots.");
  }
}

main();
