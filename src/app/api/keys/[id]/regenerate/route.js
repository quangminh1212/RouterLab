import { NextResponse } from "next/server";
import { regenerateApiKey } from "@/lib/localDb";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing key ID" }, { status: 400 });
    }

    const result = await regenerateApiKey(id);
    if (!result) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "API key regenerated successfully",
      key: result.key,
      id: result.id,
    });
  } catch (error) {
    console.log("Error regenerating key:", error);
    return NextResponse.json({ error: "Failed to regenerate key" }, { status: 500 });
  }
}
