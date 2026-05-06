import os from "os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getCpuTimes() {
  return os.cpus().reduce(
    (acc, cpu) => {
      const times = cpu.times || {};
      acc.idle += times.idle || 0;
      acc.total += Object.values(times).reduce((sum, value) => sum + (value || 0), 0);
      return acc;
    },
    { idle: 0, total: 0 }
  );
}

function getCpuUsagePercent() {
  const current = getCpuTimes();
  const previous = global.__xlabrouterSystemMetricsPrev || current;
  global.__xlabrouterSystemMetricsPrev = current;

  const idleDiff = current.idle - previous.idle;
  const totalDiff = current.total - previous.total;

  if (totalDiff <= 0) return null;
  const usage = 100 * (1 - idleDiff / totalDiff);
  return Math.max(0, Math.min(100, usage));
}

export async function GET() {
  try {
    const totalMem = os.totalmem();
    const processMemory = process.memoryUsage();
    const appUsedMem = processMemory.rss || processMemory.heapTotal || processMemory.heapUsed || 0;
    const memoryPercent = totalMem > 0 ? (appUsedMem / totalMem) * 100 : 0;
    const cpuPercent = getCpuUsagePercent();

    return NextResponse.json({
      cpuPercent,
      memoryPercent,
      usedMemoryBytes: appUsedMem,
      totalMemoryBytes: totalMem,
      processMemoryBytes: appUsedMem,
      heapUsedBytes: processMemory.heapUsed || 0,
      heapTotalBytes: processMemory.heapTotal || 0,
    });
  } catch (error) {
    console.error("[API] Failed to get system metrics:", error);
    return NextResponse.json({ error: "Failed to fetch system metrics" }, { status: 500 });
  }
}
