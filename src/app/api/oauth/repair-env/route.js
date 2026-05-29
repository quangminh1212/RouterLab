import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * POST /api/oauth/repair-env
 * Repair missing or corrupted OAuth environment variables
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { provider } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    const envPath = path.join(process.cwd(), ".env");
    const envExamplePath = path.join(process.cwd(), ".env.example");

    // Read current .env
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    // Read .env.example for reference
    let envExample = "";
    if (fs.existsSync(envExamplePath)) {
      envExample = fs.readFileSync(envExamplePath, "utf8");
    }

    const repairs = [];
    const providerUpper = provider.toUpperCase();

    // Define required OAuth variables per provider
    const requiredVars = {
      cursor: [
        `${providerUpper}_CLIENT_ID`,
        `${providerUpper}_CLIENT_SECRET`,
        `${providerUpper}_REDIRECT_URI`,
      ],
      kiro: [
        `${providerUpper}_CLIENT_ID`,
        `${providerUpper}_CLIENT_SECRET`,
        `${providerUpper}_REDIRECT_URI`,
      ],
      gitlab: [
        `${providerUpper}_CLIENT_ID`,
        `${providerUpper}_CLIENT_SECRET`,
        `${providerUpper}_REDIRECT_URI`,
      ],
    };

    const varsToCheck = requiredVars[provider.toLowerCase()] || [];

    // Check and repair each variable
    for (const varName of varsToCheck) {
      const regex = new RegExp(`^${varName}=`, "m");
      
      if (!regex.test(envContent)) {
        // Variable is missing, add it
        const exampleRegex = new RegExp(`^${varName}=(.*)$`, "m");
        const exampleMatch = envExample.match(exampleRegex);
        
        if (exampleMatch) {
          const newLine = `\n${varName}=${exampleMatch[1]}`;
          envContent += newLine;
          repairs.push({
            variable: varName,
            action: "added",
            value: exampleMatch[1],
          });
        } else {
          // Add with empty value
          const newLine = `\n${varName}=`;
          envContent += newLine;
          repairs.push({
            variable: varName,
            action: "added",
            value: "",
          });
        }
      }
    }

    // Write back to .env if repairs were made
    if (repairs.length > 0) {
      // Create backup first
      const backupPath = `${envPath}.backup.${Date.now()}`;
      if (fs.existsSync(envPath)) {
        fs.copyFileSync(envPath, backupPath);
      }

      // Write repaired content
      fs.writeFileSync(envPath, envContent, "utf8");

      return NextResponse.json({
        success: true,
        provider,
        repairs,
        backupPath,
        message: `Repaired ${repairs.length} environment variable(s)`,
      });
    } else {
      return NextResponse.json({
        success: true,
        provider,
        repairs: [],
        message: "No repairs needed",
      });
    }
  } catch (error) {
    console.error("[API] Error repairing OAuth env:", error);
    return NextResponse.json(
      { error: "Failed to repair OAuth environment" },
      { status: 500 }
    );
  }
}
