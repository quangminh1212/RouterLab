/**
 * 9router parity: POST /api/headroom/start
 * Headroom is an external process — we only report how to enable it.
 */
export async function POST() {
  return Response.json({
    success: false,
    managed: false,
    message:
      "Headroom is an external compress proxy. Start it separately " +
      "(default http://localhost:8787) and set settings.headroomUrl or HEADROOM_URL. " +
      "RouterLab rtk/headroom.js will use it automatically when available.",
    defaultUrl: "http://localhost:8787/v1/compress",
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
