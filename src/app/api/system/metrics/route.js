import os from "os";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { DATA_DIR } from "@/lib/dataDir";

export const dynamic = "force-dynamic";

const METRICS_CACHE_TTL_MS = 5000;

function getProcessCpuSnapshot() {
  return {
    usage: process.cpuUsage(),
    hrtimeNs: process.hrtime.bigint(),
  };
}

function getProcessCpuPercent() {
  const current = getProcessCpuSnapshot();
  const previous = global.__xlabrouterProcessCpuPrev || current;
  global.__xlabrouterProcessCpuPrev = current;

  const elapsedNs = Number(current.hrtimeNs - previous.hrtimeNs);
  if (!Number.isFinite(elapsedNs) || elapsedNs <= 0) return null;

  const userDiff = current.usage.user - previous.usage.user;
  const systemDiff = current.usage.system - previous.usage.system;
  const totalCpuMicros = Math.max(0, userDiff + systemDiff);
  const elapsedMicros = elapsedNs / 1000;
  const cpuCount = Math.max(1, os.cpus()?.length || 1);

  if (!Number.isFinite(elapsedMicros) || elapsedMicros <= 0) return null;

  const usage = (totalCpuMicros / (elapsedMicros * cpuCount)) * 100;
  return Math.max(0, Math.min(100, usage));
}

function getFolderSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          total += getFolderSize(full);
        } else if (entry.isFile()) {
          total += fs.statSync(full).size;
        }
      } catch {}
    }
  } catch {}
  return total;
}

function getProjectDiskUsage() {
  try {
    if (!DATA_DIR || !fs.existsSync(DATA_DIR)) return null;
    const usedBytes = getFolderSize(DATA_DIR);
    return { usedBytes };
  } catch {
    return null;
  }
}

let _diskCache = { ts: 0, value: null };
const DISK_CACHE_TTL_MS = 30000;
function getCachedDiskUsage() {
  const now = Date.now();
  if (_diskCache.value && now - _diskCache.ts < DISK_CACHE_TTL_MS) return _diskCache.value;
  const value = getProjectDiskUsage();
  _diskCache = { ts: now, value };
  return value;
}

function buildMetricsPayload() {
  const totalMem = os.totalmem();
  const processMemory = process.memoryUsage();
  const heapUsed = processMemory.heapUsed || 0;
  const rssUsed = processMemory.rss || 0;
  const appUsedMem = heapUsed || processMemory.heapTotal || rssUsed || 0;
  const memoryPercent = totalMem > 0 ? (appUsedMem / totalMem) * 100 : 0;

  const disk = getCachedDiskUsage();
  return {
    cpuPercent: getProcessCpuPercent(),
    memoryPercent,
    usedMemoryBytes: appUsedMem,
    totalMemoryBytes: totalMem,
    processMemoryBytes: rssUsed,
    heapUsedBytes: heapUsed,
    heapTotalBytes: processMemory.heapTotal || 0,
    diskUsedBytes: disk?.usedBytes ?? null,
    sampledAt: Date.now(),
  };
}

export async function GET() {
  try {
    const now = Date.now();
    const cached = global.__xlabrouterSystemMetricsCache;
    if (cached && now - cached.sampledAt < METRICS_CACHE_TTL_MS) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "private, max-age=2, stale-while-revalidate=3",
        },
      });
    }

    const payload = buildMetricsPayload();
    global.__xlabrouterSystemMetricsCache = payload;

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=2, stale-while-revalidate=3",
      },
    });
  } catch (error) {
    console.error("[API] Failed to get system metrics:", error);
    return NextResponse.json({ error: "Failed to fetch system metrics" }, { status: 500 });
  }
}
