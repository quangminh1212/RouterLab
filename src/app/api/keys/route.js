import { NextResponse } from "next/server";
import { getApiKeys, createApiKey, getApiKeySpentCost } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";

export const dynamic = "force-dynamic";

function sanitizeAllowedModels(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return null;
  const models = value
    .map((model) => (typeof model === "string" ? model.trim() : ""))
    .filter(Boolean);
  return models.length > 0 ? models : null;
}

function sanitizeRpmLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const rpm = Number(value);
  if (!Number.isFinite(rpm) || rpm <= 0) return NaN;
  return Math.floor(rpm);
}

// GET /api/keys - List API keys
export async function GET() {
  try {
    const keys = await getApiKeys();
    const keysWithUsage = await Promise.all(
      keys.map(async (key) => ({
        ...key,
        usedCost: Number((await getApiKeySpentCost(key.key)) || 0),
      }))
    );
    return NextResponse.json({ keys: keysWithUsage });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create new API key
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, hasCostLimit, costLimit, allowedModels, rpmLimit } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (hasCostLimit !== undefined && typeof hasCostLimit !== "boolean") {
      return NextResponse.json({ error: "hasCostLimit must be a boolean" }, { status: 400 });
    }

    const enableCostLimit = hasCostLimit === true;
    let normalizedCostLimit = null;
    if (enableCostLimit) {
      normalizedCostLimit = Number(costLimit);
      if (!Number.isFinite(normalizedCostLimit) || normalizedCostLimit <= 0) {
        return NextResponse.json({ error: "Cost limit must be a positive number" }, { status: 400 });
      }
      normalizedCostLimit = Number(normalizedCostLimit.toFixed(2));
    }

    if (allowedModels !== undefined && allowedModels !== null && !Array.isArray(allowedModels)) {
      return NextResponse.json({ error: "allowedModels must be an array" }, { status: 400 });
    }
    const normalizedAllowedModels = sanitizeAllowedModels(allowedModels);

    const normalizedRpmLimit = sanitizeRpmLimit(rpmLimit);
    if (Number.isNaN(normalizedRpmLimit)) {
      return NextResponse.json({ error: "RPM limit must be a positive number" }, { status: 400 });
    }

    // Always get machineId from server
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(
      name,
      machineId,
      normalizedCostLimit,
      normalizedAllowedModels,
      normalizedRpmLimit,
    );

    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name,
      id: apiKey.id,
      machineId: apiKey.machineId,
      costLimit: apiKey.costLimit,
      allowedModels: apiKey.allowedModels,
      rpmLimit: apiKey.rpmLimit,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
