import { NextResponse } from "next/server";
import { getBasicChatData, updateBasicChatData } from "@/lib/localDb";

export async function GET() {
  try {
    const state = await getBasicChatData();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to load basic chat state" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const state = await updateBasicChatData(payload);
    return NextResponse.json({ success: true, state });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to save basic chat state" }, { status: 400 });
  }
}
