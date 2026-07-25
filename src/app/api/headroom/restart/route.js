/** 9router parity: POST /api/headroom/restart */
export async function POST() {
  return Response.json({
    success: false,
    managed: false,
    message: "Restart the external Headroom process on its host. RouterLab does not supervise it.",
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
