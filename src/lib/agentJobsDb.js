// agentJobsDb.js — persistent storage for OpenAI-compatible Batch API,
// minimal Files API, and the A2A (Agent-to-Agent) protocol task lifecycle.
//
// Mirrors the self-contained lowdb pattern used by requestDetailsDb.js so it
// stays independent of the main db.json shape and is safe across hot reloads.
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { DATA_DIR } from "@/lib/dataDir.js";

const isCloud = typeof caches !== "undefined" && typeof caches === "object";
const DB_FILE = isCloud ? null : path.join(DATA_DIR, "agent-jobs.json");

// Hard caps to keep the file bounded.
const MAX_BATCHES = 500;
const MAX_FILES = 1000;
const MAX_TASKS = 500;
const MAX_AGENT_TASKS = 500;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per uploaded file content

if (!isCloud && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyData() {
  return { batches: [], files: [], tasks: [], agentTasks: [] };
}

let dbInstance = null;

async function getDb() {
  if (isCloud) {
    if (!dbInstance) {
      dbInstance = new Low({ read: async () => {}, write: async () => {} }, emptyData());
      dbInstance.data = emptyData();
    }
    return dbInstance;
  }
  if (!dbInstance) {
    if (DB_FILE && !fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(emptyData(), null, 2));
    }
    dbInstance = new Low(new JSONFile(DB_FILE), emptyData());
  }
  await dbInstance.read();
  if (!dbInstance.data || typeof dbInstance.data !== "object") dbInstance.data = emptyData();
  if (!Array.isArray(dbInstance.data.batches)) dbInstance.data.batches = [];
  if (!Array.isArray(dbInstance.data.files)) dbInstance.data.files = [];
  if (!Array.isArray(dbInstance.data.tasks)) dbInstance.data.tasks = [];
  if (!Array.isArray(dbInstance.data.agentTasks)) dbInstance.data.agentTasks = [];
  return dbInstance;
}

let writeChain = Promise.resolve();
async function persist(db) {
  if (isCloud) return;
  // Serialize writes to avoid concurrent JSONFile corruption.
  writeChain = writeChain.then(() => db.write()).catch((e) => {
    console.error("[agentJobsDb] write failed:", e?.message || e);
  });
  await writeChain;
}

function trimNewestFirst(list, max) {
  if (list.length <= max) return list;
  list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return list.slice(0, max);
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/* ----------------------------- Files API ----------------------------- */

export async function createFile({ content, filename, purpose = "batch" }) {
  const db = await getDb();
  const bytes = Buffer.byteLength(content || "", "utf8");
  if (bytes > MAX_FILE_BYTES) {
    const err = new Error(`File exceeds max size of ${MAX_FILE_BYTES} bytes`);
    err.code = "file_too_large";
    throw err;
  }
  const file = {
    id: `file-${uuidv4().replace(/-/g, "")}`,
    object: "file",
    bytes,
    created_at: nowSec(),
    filename: filename || "upload.jsonl",
    purpose,
    status: "processed",
    _content: content || "",
  };
  db.data.files.push(file);
  db.data.files = trimNewestFirst(db.data.files, MAX_FILES);
  await persist(db);
  return publicFile(file);
}

export async function getFile(id) {
  const db = await getDb();
  const file = db.data.files.find((f) => f.id === id);
  return file ? publicFile(file) : null;
}

export async function getFileContent(id) {
  const db = await getDb();
  const file = db.data.files.find((f) => f.id === id);
  return file ? (file._content || "") : null;
}

export async function listFiles(purpose = null) {
  const db = await getDb();
  let files = [...db.data.files];
  if (purpose) files = files.filter((f) => f.purpose === purpose);
  files.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return files.map(publicFile);
}

export async function deleteFile(id) {
  const db = await getDb();
  const before = db.data.files.length;
  db.data.files = db.data.files.filter((f) => f.id !== id);
  const deleted = db.data.files.length < before;
  if (deleted) await persist(db);
  return deleted;
}

async function setFileContent({ filename, purpose, content }) {
  return createFile({ content, filename, purpose });
}

function publicFile(file) {
  const { _content, ...rest } = file;
  return rest;
}

/* ----------------------------- Batch API ----------------------------- */

export async function createBatch({ input_file_id, endpoint, completion_window = "24h", metadata = null }) {
  const db = await getDb();
  const id = `batch_${uuidv4().replace(/-/g, "")}`;
  const created = nowSec();
  const batch = {
    id,
    object: "batch",
    endpoint,
    errors: null,
    input_file_id,
    completion_window,
    status: "validating",
    output_file_id: null,
    error_file_id: null,
    created_at: created,
    in_progress_at: null,
    expires_at: created + 24 * 60 * 60,
    finalizing_at: null,
    completed_at: null,
    failed_at: null,
    expired_at: null,
    cancelling_at: null,
    cancelled_at: null,
    request_counts: { total: 0, completed: 0, failed: 0 },
    metadata: metadata && typeof metadata === "object" ? metadata : null,
  };
  db.data.batches.push(batch);
  db.data.batches = trimNewestFirst(db.data.batches, MAX_BATCHES);
  await persist(db);
  return { ...batch };
}

export async function getBatch(id) {
  const db = await getDb();
  const batch = db.data.batches.find((b) => b.id === id);
  return batch ? { ...batch } : null;
}

export async function listBatches({ limit = 20, after = null } = {}) {
  const db = await getDb();
  const sorted = [...db.data.batches].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  let startIdx = 0;
  if (after) {
    const idx = sorted.findIndex((b) => b.id === after);
    if (idx >= 0) startIdx = idx + 1;
  }
  const page = sorted.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < sorted.length;
  return { data: page.map((b) => ({ ...b })), hasMore };
}

export async function updateBatch(id, updates) {
  const db = await getDb();
  const batch = db.data.batches.find((b) => b.id === id);
  if (!batch) return null;
  Object.assign(batch, updates);
  await persist(db);
  return { ...batch };
}

/* ----------------------------- A2A Tasks ----------------------------- */

export async function createTask({ skill = "", input = null, contextId = null }) {
  const db = await getDb();
  const id = `task_${uuidv4().replace(/-/g, "")}`;
  const created = nowSec();
  const task = {
    id,
    object: "a2a.task",
    skill: skill || "",
    state: "submitted", // submitted -> working -> completed | failed | canceled
    contextId: contextId || `ctx_${uuidv4().replace(/-/g, "")}`,
    input: input || null,
    artifacts: [],
    error: null,
    created_at: created,
    updated_at: created,
  };
  db.data.tasks.push(task);
  db.data.tasks = trimNewestFirst(db.data.tasks, MAX_TASKS);
  await persist(db);
  return { ...task };
}

export async function getTask(id) {
  const db = await getDb();
  const task = db.data.tasks.find((t) => t.id === id);
  return task ? { ...task } : null;
}

export async function listTasks({ limit = 50 } = {}) {
  const db = await getDb();
  const sorted = [...db.data.tasks].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return sorted.slice(0, limit).map((t) => ({ ...t }));
}

export async function updateTask(id, updates) {
  const db = await getDb();
  const task = db.data.tasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, updates, { updated_at: nowSec() });
  await persist(db);
  return { ...task };
}

/* ----------------------------- Cloud Agent Tasks ----------------------------- */

export async function createAgentTask({
  provider, prompt, repo_url, branch = "main", auto_create_pr = false,
  providerTaskId, status = "submitted",
}) {
  const db = await getDb();
  const id = `agent_task_${uuidv4().replace(/-/g, "")}`;
  const created = nowSec();
  const task = {
    id, object: "agent.task", provider, prompt, repo_url, branch,
    auto_create_pr, status, providerTaskId, result: null, error: null,
    activity: [], created_at: created, updated_at: created,
  };
  db.data.agentTasks.push(task);
  db.data.agentTasks = trimNewestFirst(db.data.agentTasks, MAX_AGENT_TASKS);
  await persist(db);
  return { ...task };
}

export async function getAgentTask(id) {
  const db = await getDb();
  const task = db.data.agentTasks.find((t) => t.id === id);
  return task ? { ...task } : null;
}

export async function listAgentTasks({ status = null, limit = 50 } = {}) {
  const db = await getDb();
  let tasks = [...db.data.agentTasks].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  if (status) tasks = tasks.filter((t) => t.status === status);
  return tasks.slice(0, limit).map((t) => ({ ...t }));
}

export async function updateAgentTask(id, updates) {
  const db = await getDb();
  const task = db.data.agentTasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, updates, { updated_at: nowSec() });
  await persist(db);
  return { ...task };
}

export { setFileContent };
