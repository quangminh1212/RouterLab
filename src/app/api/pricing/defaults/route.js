import { NextResponse } from "next/server";
import { getDefaultPricing } from "@/shared/constants/pricing.js";

export async function GET() {
  try {
    return NextResponse.json(getDefaultPricing());
  } catch (error) {
    console.error("Error fetching default pricing:", error);
    return NextResponse.json({ error: "Failed to fetch default pricing" }, { status: 500 });
  }
}
