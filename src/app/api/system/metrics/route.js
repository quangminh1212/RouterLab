import os from "os";
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

function buildMetricsPayload() {
  const totalMem = os.totalmem();
  const processMemory = process.memoryUsage();
  const appUsedMem = processMemory.rss || processMemory.heapTotal || processMemory.heapUsed || 0;
  const memoryPercent = totalMem > 0 ? (appUsedMem / totalMem) * 100 : 0;

  return {
    cpuPercent: getProcessCpuPercent(),
    memoryPercent,
    usedMemoryBytes: appUsedMem,
    totalMemoryBytes: totalMem,
    processMemoryBytes: appUsedMem,
    heapUsedBytes: processMemory.heapUsed || 0,
    heapTotalBytes: processMemory.heapTotal || 0,
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
