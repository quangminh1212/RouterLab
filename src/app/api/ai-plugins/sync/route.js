import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "CLI plugin sync has been removed. Use local RouterLab plugin integration instead." },
    { status: 410 }
  );
}
