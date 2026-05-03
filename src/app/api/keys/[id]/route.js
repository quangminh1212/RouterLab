import { NextResponse } from "next/server";
import { deleteApiKey, getApiKeyById, updateApiKey } from "@/lib/localDb";

function sanitizeAllowedModels(value) {
  if (value === null) return null;
  if (!Array.isArray(value)) return null;
  const models = value
    .map((model) => (typeof model === "string" ? model.trim() : ""))
    .filter(Boolean);
  return models.length > 0 ? models : null;
}

function sanitizeRpmLimit(value) {
  if (value === null || value === "") return null;
  const rpm = Number(value);
  if (!Number.isFinite(rpm) || rpm <= 0) return NaN;
  return Math.floor(rpm);
}

// GET /api/keys/[id] - Get single key
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ key });
  } catch (error) {
    console.log("Error fetching key:", error);
    return NextResponse.json({ error: "Failed to fetch key" }, { status: 500 });
  }
}

// PUT /api/keys/[id] - Update key
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive, name, hasCostLimit, costLimit, allowedModels, rpmLimit } = body;

    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (hasCostLimit !== undefined && typeof hasCostLimit !== "boolean") {
      return NextResponse.json({ error: "hasCostLimit must be a boolean" }, { status: 400 });
    }

    if (hasCostLimit !== undefined) {
      if (hasCostLimit === true) {
        const normalizedCostLimit = Number(costLimit);
        if (!Number.isFinite(normalizedCostLimit) || normalizedCostLimit <= 0) {
          return NextResponse.json({ error: "Cost limit must be a positive number" }, { status: 400 });
        }
        updateData.costLimit = Number(normalizedCostLimit.toFixed(2));
      } else {
        updateData.costLimit = null;
      }
    }

    if (allowedModels !== undefined) {
      if (allowedModels !== null && !Array.isArray(allowedModels)) {
        return NextResponse.json({ error: "allowedModels must be an array" }, { status: 400 });
      }
      updateData.allowedModels = sanitizeAllowedModels(allowedModels);
    }

    if (rpmLimit !== undefined) {
      const normalizedRpmLimit = sanitizeRpmLimit(rpmLimit);
      if (Number.isNaN(normalizedRpmLimit)) {
        return NextResponse.json({ error: "RPM limit must be a positive number" }, { status: 400 });
      }
      updateData.rpmLimit = normalizedRpmLimit;
    }

    const updated = await updateApiKey(id, updateData);

    return NextResponse.json({ key: updated });
  } catch (error) {
    console.log("Error updating key:", error);
    return NextResponse.json({ error: "Failed to update key" }, { status: 500 });
  }
}

// DELETE /api/keys/[id] - Delete API key
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const deleted = await deleteApiKey(id);
    if (!deleted) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Key deleted successfully" });
  } catch (error) {
    console.log("Error deleting key:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
