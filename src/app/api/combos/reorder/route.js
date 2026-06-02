import { NextResponse } from "next/server";
import { reorderCombos } from "@/lib/localDb";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { comboIds } = body;
    if (!Array.isArray(comboIds) || comboIds.length === 0) {
      return NextResponse.json({ error: "comboIds must be a non-empty array" }, { status: 400 });
    }

    const combos = await reorderCombos(comboIds);
    return NextResponse.json({ combos });
  } catch (error) {
    console.log("Error reordering combos:", error);
    const message = error?.message || "Failed to reorder combos";
    const status = /comboIds|not found/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
