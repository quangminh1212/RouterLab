import os from "os";
import fs from "fs";
import { execSync } from "child_process";
import { NextResponse } from "next/server";

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

function getDiskUsage() {
  try {
    if (process.platform === "win32") {
      const drive = (process.cwd().slice(0, 2) || "C:").toUpperCase();
      const out = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:list`, { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 3000 }).toString();
      const free = Number((out.match(/FreeSpace=(\d+)/) || [])[1] || 0);
      const size = Number((out.match(/Size=(\d+)/) || [])[1] || 0);
      if (size > 0) return { totalBytes: size, freeBytes: free, usedBytes: size - free };
    } else {
      const stat = fs.statfsSync ? fs.statfsSync(process.cwd()) : null;
      if (stat) {
        const total = Number(stat.blocks) * Number(stat.bsize);
        const free = Number(stat.bfree) * Number(stat.bsize);
        return { totalBytes: total, freeBytes: free, usedBytes: total - free };
      }
    }
  } catch {}
  return null;
}

let _diskCache = { ts: 0, value: null };
const DISK_CACHE_TTL_MS = 30000;
function getCachedDiskUsage() {
  const now = Date.now();
  if (_diskCache.value && now - _diskCache.ts < DISK_CACHE_TTL_MS) return _diskCache.value;
  const value = getDiskUsage();
  _diskCache = { ts: now, value };
  return value;
}

function buildMetricsPayload() {
  const totalMem = os.totalmem();
  const processMemory = process.memoryUsage();
  const appUsedMem = processMemory.rss || processMemory.heapTotal || processMemory.heapUsed || 0;
  const memoryPercent = totalMem > 0 ? (appUsedMem / totalMem) * 100 : 0;

  const disk = getCachedDiskUsage();
  return {
    cpuPercent: getProcessCpuPercent(),
    memoryPercent,
    usedMemoryBytes: appUsedMem,
    totalMemoryBytes: totalMem,
    processMemoryBytes: appUsedMem,
    heapUsedBytes: processMemory.heapUsed || 0,
    heapTotalBytes: processMemory.heapTotal || 0,
    diskUsedBytes: disk?.usedBytes ?? null,
    diskFreeBytes: disk?.freeBytes ?? null,
    diskTotalBytes: disk?.totalBytes ?? null,
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
