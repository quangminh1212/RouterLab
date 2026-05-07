import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "node:path";
import fs from "node:fs";
import { DATA_DIR } from "@/lib/dataDir.js";

const isCloud = typeof caches !== "undefined" && typeof caches === "object";
const DB_FILE = isCloud ? null : path.join(DATA_DIR, "disabledModels.json");
const defaultData = { disabled: {} };

if (!isCloud && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    if (isCloud) {
      dbInstance = new Low({ read: async () => {}, write: async () => {} }, defaultData);
      await dbInstance.read();
    } else {
      const adapter = new JSONFile(DB_FILE);
      dbInstance = new Low(adapter, defaultData);
      try {
        await dbInstance.read();
      } catch (error) {
        if (error instanceof SyntaxError) {
          dbInstance.data = { ...defaultData };
          await dbInstance.write();
        } else {
          throw error;
        }
      }
    }

    if (!dbInstance.data || typeof dbInstance.data !== "object") {
      dbInstance.data = { ...defaultData };
    }
    if (!dbInstance.data.disabled || typeof dbInstance.data.disabled !== "object") {
      dbInstance.data.disabled = {};
    }
  }

  return dbInstance;
}

export async function getDisabledModels() {
  const db = await getDb();
  return db.data.disabled || {};
}

export async function disableModels(providerAlias, ids) {
  if (!providerAlias || !Array.isArray(ids)) return;
  const db = await getDb();
  const current = new Set(db.data.disabled[providerAlias] || []);
  ids.forEach((id) => {
    if (typeof id === "string" && id.trim()) current.add(id);
  });
  db.data.disabled[providerAlias] = [...current];
  await db.write();
}

export async function enableModels(providerAlias, ids) {
  if (!providerAlias) return;
  const db = await getDb();
  const current = db.data.disabled[providerAlias] || [];

  if (!Array.isArray(ids) || ids.length === 0) {
    delete db.data.disabled[providerAlias];
  } else {
    const removeSet = new Set(ids.filter((id) => typeof id === "string" && id.trim()));
    const next = current.filter((id) => !removeSet.has(id));
    if (next.length === 0) delete db.data.disabled[providerAlias];
    else db.data.disabled[providerAlias] = next;
  }

  await db.write();
}
