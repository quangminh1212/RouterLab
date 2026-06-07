#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_NAME = "xlabrouter";
const SOURCE_ID = process.env.SOURCE_ID || "9router-vps";
const SOURCE_USAGE_FILE = process.env.SOURCE_USAGE_FILE || "";
const TARGET_BASE_URL = (process.env.TARGET_BASE_URL || "http://127.0.0.1:1212").replace(/\/$/, "");
const TARGET_USERNAME = process.env.TARGET_USERNAME || "admin";
const TARGET_PASSWORD = process.env.TARGET_PASSWORD || process.env.INITIAL_PASSWORD || "123456";
const APPLY = process.argv.includes("--apply");
const STATE_FILE = process.env.STATE_FILE || path.join(getDataDir(), "9router-usage-sync-state.json");

function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  return path.join(os.homedir(), `.${APP_NAME}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { version: 1, sourceId: SOURCE_ID, importedEntryIds: [], dailySnapshots: {}, batches: [] };
  const state = readJson(STATE_FILE);
  if (!Array.isArray(state.importedEntryIds)) state.importedEntryIds = [];
  if (!state.dailySnapshots || typeof state.dailySnapshots !== "object") state.dailySnapshots = {};
  if (!Array.isArray(state.batches)) state.batches = [];
  return state;
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getDateKey(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hashObject(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function emptyDay() {
  return { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, compressionSavedBytes: 0, compressionHits: 0, byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {}, byEndpoint: {} };
}

function ensureDayShape(day) {
  const shaped = day && typeof day === "object" && !Array.isArray(day) ? day : emptyDay();
  shaped.requests = normalizeNumber(shaped.requests);
  shaped.promptTokens = normalizeNumber(shaped.promptTokens);
  shaped.completionTokens = normalizeNumber(shaped.completionTokens);
  shaped.cost = normalizeNumber(shaped.cost);
  shaped.compressionSavedBytes = normalizeNumber(shaped.compressionSavedBytes);
  shaped.compressionHits = normalizeNumber(shaped.compressionHits);
  for (const key of ["byProvider", "byModel", "byAccount", "byApiKey", "byEndpoint"]) {
    if (!shaped[key] || typeof shaped[key] !== "object" || Array.isArray(shaped[key])) shaped[key] = {};
  }
  return shaped;
}

function getEntryId(entry) {
  if (entry.id) return String(entry.id);
  return hashObject({ timestamp: entry.timestamp, provider: entry.provider, model: entry.model, connectionId: entry.connectionId, endpoint: entry.endpoint, tokens: entry.tokens, cost: entry.cost });
}

function entryToDelta(entry) {
  const dateKey = getDateKey(entry.timestamp);
  if (!dateKey) return null;
  const tokens = entry.tokens || {};
  return {
    id: getEntryId(entry),
    dateKey,
    provider: entry.provider || "9router-backup",
    model: entry.model || "unknown",
    connectionId: entry.connectionId || "",
    endpoint: entry.endpoint || "",
    requests: 1,
    promptTokens: normalizeNumber(tokens.prompt_tokens ?? tokens.input_tokens ?? entry.promptTokens),
    completionTokens: normalizeNumber(tokens.completion_tokens ?? tokens.output_tokens ?? entry.completionTokens),
    cost: normalizeNumber(entry.cost),
  };
}

function summaryDayToSnapshot(day) {
  const shaped = ensureDayShape({ ...day });
  return { requests: shaped.requests, promptTokens: shaped.promptTokens, completionTokens: shaped.completionTokens, cost: shaped.cost };
}

function diffSnapshot(next, previous) {
  return {
    requests: Math.max(0, next.requests - normalizeNumber(previous?.requests)),
    promptTokens: Math.max(0, next.promptTokens - normalizeNumber(previous?.promptTokens)),
    completionTokens: Math.max(0, next.completionTokens - normalizeNumber(previous?.completionTokens)),
    cost: Math.max(0, next.cost - normalizeNumber(previous?.cost)),
  };
}

function extractSourceDeltas(source, state) {
  const importedIds = new Set(state.importedEntryIds);
  const candidates = [];
  if (Array.isArray(source.history)) candidates.push(...source.history);
  if (Array.isArray(source.records)) candidates.push(...source.records);
  if (Array.isArray(source.details)) candidates.push(...source.details);
  if (Array.isArray(source.requestDetailsData?.records)) candidates.push(...source.requestDetailsData.records);

  const deltas = [];
  const nextImportedIds = new Set(importedIds);
  for (const entry of candidates) {
    const delta = entryToDelta(entry);
    if (!delta || importedIds.has(delta.id)) continue;
    deltas.push(delta);
    nextImportedIds.add(delta.id);
  }

  const nextDailySnapshots = { ...state.dailySnapshots };
  const summary = source.dailySummary && typeof source.dailySummary === "object" && !Array.isArray(source.dailySummary) ? source.dailySummary : null;
  if (summary) {
    for (const [dateKey, day] of Object.entries(summary)) {
      const next = summaryDayToSnapshot(day);
      const delta = diffSnapshot(next, state.dailySnapshots[dateKey]);
      nextDailySnapshots[dateKey] = next;
      if (delta.requests || delta.promptTokens || delta.completionTokens || delta.cost) deltas.push({ id: `${SOURCE_ID}:${dateKey}:${hashObject(delta)}`, dateKey, provider: "9router-backup", model: "9router-daily-summary", ...delta });
    }
  }

  return { deltas, nextState: { ...state, sourceId: SOURCE_ID, importedEntryIds: Array.from(nextImportedIds).slice(-200000), dailySnapshots: nextDailySnapshots } };
}

function addCounter(target, key, values, meta) {
  if (!target[key]) target[key] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, compressionSavedBytes: 0, compressionHits: 0 };
  target[key].requests = normalizeNumber(target[key].requests) + values.requests;
  target[key].promptTokens = normalizeNumber(target[key].promptTokens) + values.promptTokens;
  target[key].completionTokens = normalizeNumber(target[key].completionTokens) + values.completionTokens;
  target[key].cost = normalizeNumber(target[key].cost) + values.cost;
  if (meta) Object.assign(target[key], meta);
}

function applyDeltaToSummary(summary, delta) {
  if (!summary[delta.dateKey]) summary[delta.dateKey] = emptyDay();
  const day = ensureDayShape(summary[delta.dateKey]);
  day.requests += delta.requests;
  day.promptTokens += delta.promptTokens;
  day.completionTokens += delta.completionTokens;
  day.cost += delta.cost;
  const providerKey = delta.provider || "9router-backup";
  const modelKey = `${delta.model || "unknown"}|${providerKey}`;
  const accountKey = `${delta.connectionId || SOURCE_ID}|${providerKey}`;
  const apiKeyKey = `${SOURCE_ID}|${providerKey}`;
  const endpointKey = `${delta.endpoint || SOURCE_ID}|${delta.model || "unknown"}|${providerKey}`;
  const meta = { source: SOURCE_ID, importedFrom: SOURCE_USAGE_FILE };
  addCounter(day.byProvider, providerKey, delta, { name: providerKey, ...meta });
  addCounter(day.byModel, modelKey, delta, { rawModel: delta.model || "unknown", provider: providerKey, ...meta });
  addCounter(day.byAccount, accountKey, delta, { accountName: SOURCE_ID, provider: providerKey, ...meta });
  addCounter(day.byApiKey, apiKeyKey, delta, { apiKeyName: SOURCE_ID, provider: providerKey, ...meta });
  addCounter(day.byEndpoint, endpointKey, delta, { endpoint: delta.endpoint || SOURCE_ID, rawModel: delta.model || "unknown", provider: providerKey, ...meta });
}

function sumRequests(summary) {
  return Object.values(summary || {}).reduce((sum, day) => sum + normalizeNumber(day?.requests), 0);
}

async function login() {
  const response = await fetch(`${TARGET_BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: TARGET_USERNAME, password: TARGET_PASSWORD }) });
  if (!response.ok) throw new Error(`Target login failed: ${response.status} ${await response.text()}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Target login did not return auth cookie");
  return cookie;
}

async function getTargetUsage(cookie) {
  const response = await fetch(`${TARGET_BASE_URL}/api/settings/usage`, { headers: { Cookie: cookie } });
  if (!response.ok) throw new Error(`Target usage export failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function importTargetUsage(cookie, payload) {
  const response = await fetch(`${TARGET_BASE_URL}/api/settings/usage`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Target usage import failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function main() {
  if (!SOURCE_USAGE_FILE) throw new Error("Set SOURCE_USAGE_FILE to the 9router usage DB JSON path");
  const source = readJson(SOURCE_USAGE_FILE);
  const state = loadState();
  const { deltas, nextState } = extractSourceDeltas(source, state);
  const addedRequests = deltas.reduce((sum, item) => sum + item.requests, 0);
  const addedTokens = deltas.reduce((sum, item) => sum + item.promptTokens + item.completionTokens, 0);
  const addedCost = deltas.reduce((sum, item) => sum + item.cost, 0);
  if (!deltas.length) {
    console.log(JSON.stringify({ ok: true, applied: false, reason: "no-new-usage", sourceId: SOURCE_ID }, null, 2));
    return;
  }

  const cookie = await login();
  const target = await getTargetUsage(cookie);
  target.history = [];
  target.dailySummary = target.dailySummary && typeof target.dailySummary === "object" ? target.dailySummary : {};
  for (const delta of deltas) applyDeltaToSummary(target.dailySummary, delta);
  target.totalRequestsLifetime = Math.max(normalizeNumber(target.totalRequestsLifetime), sumRequests(target.dailySummary));
  target.metadata = { ...(target.metadata || {}), last9RouterDbSync: { sourceId: SOURCE_ID, sourceFile: SOURCE_USAGE_FILE, syncedAt: new Date().toISOString(), addedRequests, addedTokens, addedCost, deltaCount: deltas.length } };

  if (APPLY) {
    await importTargetUsage(cookie, target);
    nextState.batches.push({ at: new Date().toISOString(), addedRequests, addedTokens, addedCost, deltaCount: deltas.length });
    nextState.batches = nextState.batches.slice(-500);
    writeJsonAtomic(STATE_FILE, nextState);
  }

  console.log(JSON.stringify({ ok: true, applied: APPLY, sourceId: SOURCE_ID, stateFile: STATE_FILE, addedRequests, addedTokens, addedCost, deltaCount: deltas.length }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
