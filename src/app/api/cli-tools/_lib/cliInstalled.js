import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CACHE_TTL_MS = 30_000;
const _cache = new Map();

function pathSeparator() {
  return os.platform() === "win32" ? ";" : ":";
}

function executableCandidates(name) {
  if (os.platform() !== "win32") return [name];
  const exts = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const lower = name.toLowerCase();
  if (exts.some((ext) => lower.endsWith(ext.toLowerCase()))) return [name];
  return [name, ...exts.map((ext) => name + ext)];
}

function pathDirs() {
  const base = (process.env.PATH || "").split(pathSeparator()).filter(Boolean);
  if (os.platform() === "win32" && process.env.APPDATA) {
    base.unshift(path.join(process.env.APPDATA, "npm"));
  }
  return base;
}

async function findInPath(name) {
  const candidates = executableCandidates(name);
  for (const dir of pathDirs()) {
    for (const candidate of candidates) {
      try {
        const target = path.join(dir, candidate);
        const stat = await fs.stat(target);
        if (stat.isFile()) return target;
      } catch {}
    }
  }
  return null;
}

/**
 * Check whether a CLI binary is installed without shelling out.
 * Results are cached for CACHE_TTL_MS to avoid repeated FS scans.
 * @param {string} name - executable name (e.g. "claude")
 * @param {string|string[]} fallbackPaths - config files that imply install presence
 */
export async function isCliInstalled(name, fallbackPaths = []) {
  const key = `${name}|${Array.isArray(fallbackPaths) ? fallbackPaths.join("|") : String(fallbackPaths)}`;
  const now = Date.now();
  const cached = _cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.value;

  let installed = false;
  try {
    if (await findInPath(name)) installed = true;
  } catch {}

  if (!installed) {
    const fallbacks = Array.isArray(fallbackPaths) ? fallbackPaths : [fallbackPaths];
    for (const fp of fallbacks) {
      if (!fp) continue;
      try {
        await fs.access(fp);
        installed = true;
        break;
      } catch {}
    }
  }

  _cache.set(key, { ts: now, value: installed });
  return installed;
}

export function invalidateCliInstalledCache(name) {
  if (!name) { _cache.clear(); return; }
  for (const key of _cache.keys()) {
    if (key.startsWith(`${name}|`)) _cache.delete(key);
  }
}
