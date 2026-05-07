const { NextResponse } = require("next/server");
const { compressMessage, compressMessages, calculateStats, DEFAULT_CONFIG } = require("@/lib/compression/caveman");
const rtk = require("@/lib/compression/rtk");

const SUPPORTED_MODES = ["caveman", "rtk", "stacked"];

function compressTextByMode(text, mode, config) {
  if (mode === "rtk") {
    return rtk.compressOutput(text, config.rtkConfig);
  }

  if (mode === "stacked") {
    const rtkCompressed = rtk.compressOutput(text, config.rtkConfig);
    return compressMessage(rtkCompressed, config.cavemanConfig);
  }

  return compressMessage(text, config.cavemanConfig);
}

function compressMessagesByMode(messages, mode, config) {
  const body = { messages };

  if (mode === "rtk") {
    return rtk.compressMessages(body, config.rtkConfig).messages;
  }

  if (mode === "stacked") {
    const rtkBody = rtk.compressMessages(body, config.rtkConfig);
    return compressMessages(rtkBody, config.cavemanConfig).messages;
  }

  return compressMessages(body, config.cavemanConfig).messages;
}

/**
 * POST /api/compression
 * Test compression on a message or messages
 */
exports.POST = async function POST(request) {
  try {
    const body = await request.json();
    const { text, messages, intensity = "full", mode = "caveman" } = body;

    if (!SUPPORTED_MODES.includes(mode)) {
      return NextResponse.json(
        { error: `Unsupported compression mode: ${mode}` },
        { status: 400 }
      );
    }

    const config = {
      cavemanConfig: {
        ...DEFAULT_CONFIG,
        intensity,
      },
      rtkConfig: {
        ...rtk.DEFAULT_CONFIG,
      },
    };

    // Single message compression
    if (text) {
      const compressed = compressTextByMode(text, mode, config);
      const stats = calculateStats(text, compressed);

      return NextResponse.json({
        mode,
        original: text,
        compressed,
        stats,
      });
    }

    // Multiple messages compression
    if (messages) {
      const compressedMessages = compressMessagesByMode(messages, mode, config);

      const originalText = JSON.stringify(messages);
      const compressedText = JSON.stringify(compressedMessages);
      const stats = calculateStats(originalText, compressedText);

      return NextResponse.json({
        mode,
        original: messages,
        compressed: compressedMessages,
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
    modes: SUPPORTED_MODES,
    intensityLevels: ["lite", "full", "ultra"],
    defaultIntensity: "full",
    defaultMode: "caveman",
    config: DEFAULT_CONFIG,
    rtkConfig: rtk.DEFAULT_CONFIG,
  });
};
