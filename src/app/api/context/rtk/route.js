const { NextResponse } = require("next/server");
const { DEFAULT_CONFIG, compressOutput, calculateStats, detectCommandCategory } = require("@/lib/compression/rtk");

/**
 * GET /api/context/rtk
 * Get RTK compression configuration
 */
exports.GET = async function GET() {
  return NextResponse.json({
    enabled: true,
    engine: "rtk",
    config: DEFAULT_CONFIG,
    categories: ["git", "test", "build", "package", "docker", "shell", "generic"],
  });
};

/**
 * POST /api/context/rtk
 * Preview RTK compression for command/tool output
 */
exports.POST = async function POST(request) {
  try {
    const body = await request.json();
    const { text, config = {} } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing text" },
        { status: 400 }
      );
    }

    const rtkConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    const compressed = compressOutput(text, rtkConfig);
    const stats = calculateStats(text, compressed);

    return NextResponse.json({
      engine: "rtk",
      category: detectCommandCategory(text),
      original: text,
      compressed,
      stats,
    });
  } catch (error) {
    console.error("[API] RTK compression error:", error);
    return NextResponse.json(
      { error: "RTK compression failed" },
      { status: 500 }
    );
  }
};
