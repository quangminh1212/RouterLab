import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { getConsoleLogs } from "@/lib/consoleLogBuffer";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { DATA_DIR } from "@/lib/dataDir";
import { jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/auth/sessionSecret";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_FILES = 120;

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";
const SECRET = getAuthSecret();
let cachedCliToken = null;

async function getCliToken() {
  if (!cachedCliToken) cachedCliToken = await getConsistentMachineId(CLI_TOKEN_SALT);
  return cachedCliToken;
}

function isLocalhostRequest(request) {
  const host = String(request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function hasValidCliToken(request) {
  const token = request.headers.get(CLI_TOKEN_HEADER);
  if (!token) return false;
  return token === await getCliToken();
}

async function hasValidToken(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

function safeReadTextFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const tooLarge = stat.size > MAX_FILE_SIZE_BYTES;
    const content = fs.readFileSync(filePath, "utf8");
    return {
      filePath,
      size: stat.size,
      tooLarge,
      content: tooLarge ? `${content.slice(0, MAX_FILE_SIZE_BYTES)}\n\n...[truncated]...` : content,
    };
  } catch {
    return null;
  }
}

function collectLogFilesFromDir(dirPath, acc = []) {
  if (!dirPath || !fs.existsSync(dirPath)) return acc;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (acc.length >= MAX_TOTAL_FILES) break;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectLogFilesFromDir(fullPath, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.log(\.\w+)?$/i.test(entry.name) || /console|error|out|stderr|stdout/i.test(entry.name)) {
      const fileData = safeReadTextFile(fullPath);
      if (fileData) acc.push(fileData);
    }
  }
  return acc;
}

function getGitInfo() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const commit = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const status = execSync("git status --short", { stdio: ["ignore", "pipe", "ignore"] }).toString();
    return { branch, commit, status };
  } catch {
    return { branch: "", commit: "", status: "" };
  }
}

export async function GET(request) {
  try {
    if (!isLocalhostRequest(request) && !(await hasValidCliToken(request)) && !(await hasValidToken(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const cwd = process.cwd();
    const logsDir = path.join(cwd, "logs");
    const rootFiles = fs.existsSync(cwd) ? fs.readdirSync(cwd) : [];
    const tmpLogCandidates = rootFiles
      .filter((name) => /\.log($|\.)|^\.tmp-.*\.log/i.test(name))
      .slice(0, MAX_TOTAL_FILES)
      .map((name) => safeReadTextFile(path.join(cwd, name)))
      .filter(Boolean);

    const logsFiles = collectLogFilesFromDir(logsDir, []);
    const dataLogFiles = collectLogFilesFromDir(path.join(DATA_DIR, "logs"), []);

    const payload = {
      exportedAt: new Date().toISOString(),
      machine: {
        platform: process.platform,
        release: os.release(),
        arch: process.arch,
        hostname: os.hostname(),
        node: process.version,
        cwd,
        dataDir: DATA_DIR,
      },
      git: getGitInfo(),
      runtimeConsoleBuffer: getConsoleLogs(),
      files: [
        ...tmpLogCandidates,
        ...logsFiles,
        ...dataLogFiles,
      ].slice(0, MAX_TOTAL_FILES),
    };

    const body = JSON.stringify(payload, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=logs-bundle-${Date.now()}.json`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to export logs" }, { status: 500 });
  }
}

