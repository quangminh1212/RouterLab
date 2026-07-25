/**
 * Credential store abstraction (CLIProxyAPI parity).
 *
 * CLIProxyAPI supports file / postgres / git / S3-backed credential stores.
 * RouterLab defaults to the existing lowdb/file store; optional backends can be
 * selected via env CREDENTIAL_STORE=file|postgres|git|s3.
 *
 * This module is a thin adapter — production still uses localDb for connections.
 * Postgres/Git/S3 backends are full drivers (require env + optional npm deps).
 */

import { getSettings } from "./localDb.js";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const mode = () =>
  String(process.env.CREDENTIAL_STORE || process.env.CLIPROXY_CREDENTIAL_STORE || "file")
    .trim()
    .toLowerCase();

/**
 * @typedef {object} CredentialRecord
 * @property {string} id
 * @property {string} provider
 * @property {string} [apiKey]
 * @property {string} [accessToken]
 * @property {string} [refreshToken]
 * @property {string} [expiresAt]
 * @property {object} [providerSpecificData]
 */

/** File-backed store (default) — reads from local settings/connections. */
const fileStore = {
  name: "file",
  async list(provider) {
    const settings = await getSettings();
    const connections = settings?.connections || settings?.providers || [];
    const list = Array.isArray(connections) ? connections : Object.values(connections || {});
    return list
      .filter((c) => !provider || c.provider === provider || c.type === provider)
      .map(normalizeConnection);
  },
  async get(id) {
    const all = await this.list();
    return all.find((c) => c.id === id) || null;
  },
  async put() {
    throw new Error(
      "file credential store is read-only via this adapter; use dashboard/API to write connections"
    );
  },
  async remove() {
    throw new Error(
      "file credential store is read-only via this adapter; use dashboard/API to delete connections"
    );
  },
};

function normalizeConnection(c) {
  return {
    id: c.id || c.connectionId || c.uuid,
    provider: c.provider || c.type,
    apiKey: c.apiKey,
    accessToken: c.accessToken,
    refreshToken: c.refreshToken,
    expiresAt: c.expiresAt,
    providerSpecificData: c.providerSpecificData || c.metadata || {},
  };
}

/**
 * Postgres backend (CLIProxyAPI parity).
 * Env: CREDENTIAL_STORE=postgres, DATABASE_URL=postgres://...
 * Uses dynamic `pg` import when available; otherwise clear error.
 */
const postgresStore = {
  name: "postgres",
  async _pool() {
    if (this.__pool) return this.__pool;
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
      throw new Error(
        "CREDENTIAL_STORE=postgres requires DATABASE_URL (or POSTGRES_URL)."
      );
    }
    let pg;
    try {
      pg = await import("pg");
    } catch {
      throw new Error(
        "CREDENTIAL_STORE=postgres requires the `pg` package: npm i pg"
      );
    }
    const { Pool } = pg.default || pg;
    this.__pool = new Pool({ connectionString: url });
    await this.__pool.query(`
      CREATE TABLE IF NOT EXISTS routerlab_credentials (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    return this.__pool;
  },
  async list(provider) {
    const pool = await this._pool();
    const q = provider
      ? await pool.query(
          "SELECT id, provider, payload FROM routerlab_credentials WHERE provider = $1 ORDER BY updated_at DESC",
          [provider]
        )
      : await pool.query(
          "SELECT id, provider, payload FROM routerlab_credentials ORDER BY updated_at DESC"
        );
    return q.rows.map((r) => ({ id: r.id, provider: r.provider, ...r.payload }));
  },
  async get(id) {
    const pool = await this._pool();
    const q = await pool.query(
      "SELECT id, provider, payload FROM routerlab_credentials WHERE id = $1",
      [id]
    );
    if (!q.rows[0]) return null;
    const r = q.rows[0];
    return { id: r.id, provider: r.provider, ...r.payload };
  },
  async put(record) {
    if (!record?.id || !record?.provider) {
      throw new Error("credential put requires id and provider");
    }
    const pool = await this._pool();
    const { id, provider, ...payload } = record;
    await pool.query(
      `INSERT INTO routerlab_credentials (id, provider, payload, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET provider = EXCLUDED.provider, payload = EXCLUDED.payload, updated_at = NOW()`,
      [id, provider, JSON.stringify(payload)]
    );
    return record;
  },
  async remove(id) {
    const pool = await this._pool();
    await pool.query("DELETE FROM routerlab_credentials WHERE id = $1", [id]);
    return true;
  },
};

/**
 * Git backend (CLIProxyAPI parity) — stores credentials as JSON under a git dir.
 * Env: CREDENTIAL_STORE=git, CREDENTIAL_GIT_DIR=/path/to/repo
 */
const gitStore = {
  name: "git",
  _dir() {
    const dir =
      process.env.CREDENTIAL_GIT_DIR ||
      process.env.CLIPROXY_AUTH_DIR ||
      path.join(process.cwd(), ".credentials-git");
    return dir;
  },
  async _ensure() {
    const dir = this._dir();
    await fs.mkdir(dir, { recursive: true });
    try {
      await execFileAsync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"]);
    } catch {
      await execFileAsync("git", ["-C", dir, "init"]);
    }
    return dir;
  },
  _file(dir, id) {
    const safe = String(id).replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(dir, `${safe}.json`);
  },
  async list(provider) {
    const dir = await this._ensure();
    const names = await fs.readdir(dir);
    const out = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
        if (!provider || raw.provider === provider) out.push(raw);
      } catch {
        // skip
      }
    }
    return out;
  },
  async get(id) {
    const dir = await this._ensure();
    try {
      return JSON.parse(await fs.readFile(this._file(dir, id), "utf8"));
    } catch {
      return null;
    }
  },
  async put(record) {
    if (!record?.id) throw new Error("credential put requires id");
    const dir = await this._ensure();
    const file = this._file(dir, record.id);
    await fs.writeFile(file, JSON.stringify(record, null, 2), "utf8");
    try {
      await execFileAsync("git", ["-C", dir, "add", path.basename(file)]);
      await execFileAsync("git", [
        "-C",
        dir,
        "commit",
        "-m",
        `upsert ${record.id}`,
        "--allow-empty",
      ]);
    } catch {
      // non-fatal if git commit fails (identity not set)
    }
    return record;
  },
  async remove(id) {
    const dir = await this._ensure();
    try {
      await fs.unlink(this._file(dir, id));
      await execFileAsync("git", ["-C", dir, "add", "-A"]);
      await execFileAsync("git", ["-C", dir, "commit", "-m", `remove ${id}`, "--allow-empty"]);
    } catch {
      // ignore
    }
    return true;
  },
};

/**
 * S3/object store backend (CLIProxyAPI parity).
 * Env: CREDENTIAL_STORE=s3, S3_BUCKET, AWS_REGION, optional S3_PREFIX
 * Uses AWS SDK v3 when available.
 */
const s3Store = {
  name: "s3",
  async _client() {
    if (this.__client) return this.__client;
    const bucket = process.env.S3_BUCKET || process.env.CREDENTIAL_S3_BUCKET;
    if (!bucket) {
      throw new Error("CREDENTIAL_STORE=s3 requires S3_BUCKET");
    }
    let S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand;
    try {
      const mod = await import("@aws-sdk/client-s3");
      ({
        S3Client,
        PutObjectCommand,
        GetObjectCommand,
        ListObjectsV2Command,
        DeleteObjectCommand,
      } = mod);
    } catch {
      throw new Error(
        "CREDENTIAL_STORE=s3 requires @aws-sdk/client-s3: npm i @aws-sdk/client-s3"
      );
    }
    this.__bucket = bucket;
    this.__prefix = (process.env.S3_PREFIX || "credentials/").replace(/\/?$/, "/");
    this.__client = new S3Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
    this.__cmds = {
      PutObjectCommand,
      GetObjectCommand,
      ListObjectsV2Command,
      DeleteObjectCommand,
    };
    return this.__client;
  },
  async list(provider) {
    const client = await this._client();
    const { ListObjectsV2Command } = this.__cmds;
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: this.__bucket, Prefix: this.__prefix })
    );
    const out = [];
    for (const obj of res.Contents || []) {
      if (!obj.Key?.endsWith(".json")) continue;
      const rec = await this.get(obj.Key.slice(this.__prefix.length).replace(/\.json$/, ""));
      if (rec && (!provider || rec.provider === provider)) out.push(rec);
    }
    return out;
  },
  async get(id) {
    const client = await this._client();
    const { GetObjectCommand } = this.__cmds;
    try {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: this.__bucket,
          Key: `${this.__prefix}${id}.json`,
        })
      );
      const text = await res.Body.transformToString();
      return JSON.parse(text);
    } catch {
      return null;
    }
  },
  async put(record) {
    if (!record?.id) throw new Error("credential put requires id");
    const client = await this._client();
    const { PutObjectCommand } = this.__cmds;
    await client.send(
      new PutObjectCommand({
        Bucket: this.__bucket,
        Key: `${this.__prefix}${record.id}.json`,
        Body: JSON.stringify(record),
        ContentType: "application/json",
      })
    );
    return record;
  },
  async remove(id) {
    const client = await this._client();
    const { DeleteObjectCommand } = this.__cmds;
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.__bucket,
        Key: `${this.__prefix}${id}.json`,
      })
    );
    return true;
  },
};

const stores = {
  file: fileStore,
  postgres: postgresStore,
  pg: postgresStore,
  git: gitStore,
  s3: s3Store,
  object: s3Store,
};

/**
 * @returns {{ name: string, list: Function, get: Function, put: Function, remove: Function }}
 */
export function getCredentialStore() {
  const key = mode();
  return stores[key] || fileStore;
}

export function getCredentialStoreMode() {
  return mode();
}

export async function listCredentials(provider) {
  return getCredentialStore().list(provider);
}

export async function getCredential(id) {
  return getCredentialStore().get(id);
}
