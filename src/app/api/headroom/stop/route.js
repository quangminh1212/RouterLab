/** 9router parity: POST /api/headroom/stop — external process; no-op managed. */
export async function POST() {
  return Response.json({
    success: true,
    managed: false,
    message: "Headroom is external; stop the process on the host running it.",
  });
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
