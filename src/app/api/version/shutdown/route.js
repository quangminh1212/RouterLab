/**
 * 9router parity: POST /api/version/shutdown
 * Also available at /api/shutdown — graceful process exit for updates.
 */
export async function POST() {
  const response = Response.json({
    success: true,
    message: "Shutting down for manual update...",
  });
  setTimeout(() => {
    try {
      process.exit(0);
    } catch {
      // ignore
    }
  }, 500);
  return response;
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
