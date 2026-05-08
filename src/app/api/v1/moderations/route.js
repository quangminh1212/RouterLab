/**
 * POST /v1/moderations - OpenAI-compatible moderation endpoint
 * Stub for future provider integration (OpenAI, Azure, etc.)
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const input = body.input || "";
    
    // Stub response - OpenAI moderation format
    // Real implementation would route to provider (openai/text-moderation-latest, azure, etc.)
    return new Response(
      JSON.stringify({
        id: `modr-${Date.now()}`,
        model: body.model || "text-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {
              sexual: false,
              hate: false,
              harassment: false,
              "self-harm": false,
              "sexual/minors": false,
              "hate/threatening": false,
              "violence/graphic": false,
              "self-harm/intent": false,
              "self-harm/instructions": false,
              "harassment/threatening": false,
              violence: false,
            },
            category_scores: {
              sexual: 0.0,
              hate: 0.0,
              harassment: 0.0,
              "self-harm": 0.0,
              "sexual/minors": 0.0,
              "hate/threatening": 0.0,
              "violence/graphic": 0.0,
              "self-harm/intent": 0.0,
              "self-harm/instructions": 0.0,
              "harassment/threatening": 0.0,
              violence: 0.0,
            },
          },
        ],
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: error.message || "Invalid request" } }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
