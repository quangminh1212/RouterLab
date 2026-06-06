import { NextResponse } from "next/server";
import { getProviderMachineId } from "@/shared/utils/machineId";

export async function GET() {
  try {
    const machineId = getProviderMachineId(null);
    return NextResponse.json({ machineId });
  } catch (error) {
    console.log("Error getting machine id:", error);
    return NextResponse.json({ error: "Failed to get machine id" }, { status: 500 });
  }
}
