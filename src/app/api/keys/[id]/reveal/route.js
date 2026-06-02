import { NextResponse } from "next/server";
import { getApiKeyById } from "@/lib/localDb";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing key ID" }, { status: 400 });
    }

    const key = await getApiKeyById(id);
    if (!key || typeof key.key !== "string") {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ key: key.key });
  } catch (error) {
    console.log("Error revealing key:", error);
    return NextResponse.json({ error: "Failed to reveal key" }, { status: 500 });
  }
}
