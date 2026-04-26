import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "CLI sync has been removed. Use local XLab Router MCP integration instead." },
    { status: 410 }
  );
}
