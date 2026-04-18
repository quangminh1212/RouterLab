import { NextResponse } from "next/server";
import { getApiKeys, createApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";

export const dynamic = "force-dynamic";

// GET /api/keys - List API keys
export async function GET() {
  try {
    const keys = await getApiKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create new API key
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, hasCostLimit, costLimit } = body;

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

    // Always get machineId from server
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(name, machineId, normalizedCostLimit);

    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name,
      id: apiKey.id,
      machineId: apiKey.machineId,
      costLimit: apiKey.costLimit,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
