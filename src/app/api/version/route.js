import https from "https";
import fs from "node:fs/promises";
import path from "node:path";
import pkg from "../../../../package.json" with { type: "json" };

const NPM_PACKAGE_NAME = "xlabrouter";
const VERSION_CACHE_TTL_MS = 10 * 60 * 1000;
let versionCache = { ts: 0, data: null, promise: null };

function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(
      `https://registry.npmjs.org/${NPM_PACKAGE_NAME}/latest`,
      { timeout: 4000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).version || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function readBuildId() {
  const candidates = [
    path.join(process.cwd(), '.next', 'BUILD_ID'),
    path.join(process.cwd(), 'BUILD_ID'),
    path.join(process.cwd(), '.next', 'standalone', '.next', 'BUILD_ID'),
  ];
  for (const file of candidates) {
    try {
      const value = (await fs.readFile(file, 'utf8')).trim();
      if (value) return value;
    } catch {}
  }
  return null;
}
function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function refreshVersionCache() {
  if (versionCache.promise) return versionCache.promise;
  versionCache.promise = (async () => {
    const latestVersion = await fetchLatestVersion();
    const currentVersion = pkg.version;
    const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;
    const buildId = await readBuildId();
    const payload = { currentVersion, latestVersion, hasUpdate, buildId, serverTime: new Date().toISOString() };
    versionCache = { ts: Date.now(), data: payload, promise: null };
    return payload;
  })();
  return versionCache.promise;
}

export async function GET() {
  const now = Date.now();
  const isFresh = versionCache.data && now - versionCache.ts < VERSION_CACHE_TTL_MS;

  if (isFresh) {
    return Response.json(versionCache.data, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
  }

  // Return stale/fast response immediately, refresh in background.
  const fallback = versionCache.data || { currentVersion: pkg.version, latestVersion: null, hasUpdate: false, buildId: null, serverTime: new Date().toISOString() };
  refreshVersionCache().catch(() => {});

  return Response.json(fallback, {
    headers: {
      "Cache-Control": "private, max-age=15, stale-while-revalidate=300",
      "X-Version-Refresh": versionCache.data ? "stale" : "pending",
    },
  });
}
