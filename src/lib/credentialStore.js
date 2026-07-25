/**
 * Credential store abstraction (CLIProxyAPI parity).
 *
 * CLIProxyAPI supports file / postgres / git / S3-backed credential stores.
 * RouterLab defaults to the existing lowdb/file store; optional backends can be
 * selected via env CREDENTIAL_STORE=file|postgres|git|s3.
 *
 * This module is a thin adapter — production still uses localDb for connections.
 * Postgres/Git/S3 backends are pluggable stubs that document the interface and
 * fail clearly when dependencies/config are missing.
 */

import { getSettings } from "./localDb.js";

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

function unsupportedBackend(name) {
  return {
    name,
    async list() {
      throw new Error(
        `CREDENTIAL_STORE=${name} is not configured. ` +
          `Set the required env vars (see docs/FEATURE-PARITY-CHECKLIST.md CLIProxyAPI stores) ` +
          `or use CREDENTIAL_STORE=file (default).`
      );
    },
    async get() {
      return this.list();
    },
    async put() {
      return this.list();
    },
    async remove() {
      return this.list();
    },
  };
}

const stores = {
  file: fileStore,
  postgres: unsupportedBackend("postgres"),
  pg: unsupportedBackend("postgres"),
  git: unsupportedBackend("git"),
  s3: unsupportedBackend("s3"),
  object: unsupportedBackend("s3"),
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
