const { NextResponse } = require("next/server");
const { compressMessage, compressMessages, calculateStats, DEFAULT_CONFIG } = require("@/lib/compression/caveman");

/**
 * POST /api/compression
 * Test compression on a message or messages
 */
exports.POST = async function POST(request) {
  try {
    const body = await request.json();
    const { text, messages, intensity = "full" } = body;

    const config = {
      ...DEFAULT_CONFIG,
      intensity,
    };

    // Single message compression
    if (text) {
      const compressed = compressMessage(text, config);
      const stats = calculateStats(text, compressed);

      return NextResponse.json({
        original: text,
        compressed,
        stats,
      });
    }

    // Multiple messages compression
    if (messages) {
      const originalBody = { messages };
      const compressedBody = compressMessages(originalBody, config);

      const originalText = JSON.stringify(messages);
      const compressedText = JSON.stringify(compressedBody.messages);
      const stats = calculateStats(originalText, compressedText);

      return NextResponse.json({
        original: messages,
        compressed: compressedBody.messages,
        stats,
      });
    }

    return NextResponse.json(
      { error: "Missing text or messages" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Compression error:", error);
    return NextResponse.json(
      { error: "Compression failed" },
      { status: 500 }
    );
  }
};

/**
 * GET /api/compression
 * Get compression configuration
 */
exports.GET = async function GET() {
  return NextResponse.json({
    enabled: true,
    intensityLevels: ["lite", "full", "ultra"],
    defaultIntensity: "full",
    config: DEFAULT_CONFIG,
  });
};
