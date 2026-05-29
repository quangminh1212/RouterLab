const { NextResponse } = require("next/server");
const { getSettings, updateSettings } = require("@/lib/localDb");

/**
 * PATCH /api/models/visibility
 * Toggle model visibility in catalog
 */
exports.PATCH = async function PATCH(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { modelId, visible } = body;

    if (!modelId || typeof visible !== "boolean") {
      return NextResponse.json(
        { error: "Missing modelId or visible flag" },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    const hiddenModels = settings.hiddenModels || [];

    let updated;
    if (visible) {
      updated = hiddenModels.filter((id) => id !== modelId);
    } else {
      if (!hiddenModels.includes(modelId)) {
        updated = [...hiddenModels, modelId];
      } else {
        updated = hiddenModels;
      }
    }

    await updateSettings({ hiddenModels: updated });

    return NextResponse.json({
      success: true,
      modelId,
      visible,
      hiddenCount: updated.length,
    });
  } catch (error) {
    console.error("[API] Error toggling model visibility:", error);
    return NextResponse.json(
      { error: "Failed to toggle model visibility" },
      { status: 500 }
    );
  }
};

/**
 * GET /api/models/visibility
 * Get list of hidden models
 */
exports.GET = async function GET() {
  try {
    const settings = await getSettings();
    const hiddenModels = settings.hiddenModels || [];

    return NextResponse.json({
      hiddenModels,
      count: hiddenModels.length,
    });
  } catch (error) {
    console.error("[API] Error getting hidden models:", error);
    return NextResponse.json(
      { error: "Failed to get hidden models" },
      { status: 500 }
    );
  }
};
