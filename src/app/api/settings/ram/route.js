import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RAM_CONFIG_FILE = path.join(process.cwd(), ".ram-config.json");

function readRamConfig() {
  try {
    if (fs.existsSync(RAM_CONFIG_FILE)) {
      const data = fs.readFileSync(RAM_CONFIG_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading RAM config:", error);
  }
  return { ram: 2048 };
}

function writeRamConfig(config) {
  try {
    fs.writeFileSync(RAM_CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Error writing RAM config:", error);
    return false;
  }
}

export async function GET() {
  const config = readRamConfig();
  return NextResponse.json(config);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const ram = parseInt(body.ram);

    if (isNaN(ram) || ram < 256 || ram > 32768) {
      return NextResponse.json(
        { error: "Invalid RAM value (256-32768 MB)" },
        { status: 400 }
      );
    }

    const success = writeRamConfig({ ram });
    if (success) {
      return NextResponse.json({ success: true, ram });
    } else {
      return NextResponse.json(
        { error: "Failed to save config" },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}