import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

function normalizeHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "::1" || raw === "[::1]") return "::1";
  if (raw.startsWith("[::1]:")) return "::1";
  return raw.split(":")[0];
}

function isLocalRequest(request) {
  return [
    request.nextUrl?.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ].some((value) => {
    const host = normalizeHost(value);
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  });
}

function deny() {
  return NextResponse.json({ error: "Management API is restricted to localhost" }, { status: 403 });
}

function sanitizeMappings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, target] of Object.entries(value)) {
    const source = String(key || "").trim();
    const mapped = typeof target === "string" ? target.trim() : "";
    if (!source || !mapped || !mapped.includes("/")) continue;
    out[source] = mapped;
  }
  return out;
}

function normalizeForceEnabled(value) {
  return value === true;
}

export async function GET(request) {
  if (!isLocalRequest(request)) return deny();
  const settings = await getSettings();
  return NextResponse.json({
    mappings: sanitizeMappings(settings.forcedModelMappings),
    forceEnabled: normalizeForceEnabled(settings.forceModelMappings),
  });
}

export async function PUT(request) {
  if (!isLocalRequest(request)) return deny();
  const body = await request.json();
  const mappings = sanitizeMappings(body?.mappings);
  const nextSettings = { forcedModelMappings: mappings };
  if (Object.prototype.hasOwnProperty.call(body || {}, "forceEnabled")) {
    nextSettings.forceModelMappings = normalizeForceEnabled(body.forceEnabled);
  }
  const settings = await updateSettings(nextSettings);
  return NextResponse.json({
    success: true,
    mappings: sanitizeMappings(settings.forcedModelMappings),
    forceEnabled: normalizeForceEnabled(settings.forceModelMappings),
  });
}

export async function PATCH(request) {
  if (!isLocalRequest(request)) return deny();
  const body = await request.json();
  const settings = await getSettings();
  const current = sanitizeMappings(settings.forcedModelMappings);
  const patch = sanitizeMappings(body?.mappings);
  const next = { ...current, ...patch };
  const nextSettings = { forcedModelMappings: next };
  if (Object.prototype.hasOwnProperty.call(body || {}, "forceEnabled")) {
    nextSettings.forceModelMappings = normalizeForceEnabled(body.forceEnabled);
  }
  const updated = await updateSettings(nextSettings);
  return NextResponse.json({
    success: true,
    mappings: sanitizeMappings(updated.forcedModelMappings),
    forceEnabled: normalizeForceEnabled(updated.forceModelMappings),
  });
}

export async function DELETE(request) {
  if (!isLocalRequest(request)) return deny();
  const body = await request.json().catch(() => ({}));
  const aliases = Array.isArray(body?.aliases) ? body.aliases.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const settings = await getSettings();
  const current = sanitizeMappings(settings.forcedModelMappings);
  for (const alias of aliases) delete current[alias];
  const nextSettings = { forcedModelMappings: current };
  if (Object.prototype.hasOwnProperty.call(body || {}, "forceEnabled")) {
    nextSettings.forceModelMappings = normalizeForceEnabled(body.forceEnabled);
  }
  const updated = await updateSettings(nextSettings);
  return NextResponse.json({
    success: true,
    mappings: sanitizeMappings(updated.forcedModelMappings),
    forceEnabled: normalizeForceEnabled(updated.forceModelMappings),
  });
}
