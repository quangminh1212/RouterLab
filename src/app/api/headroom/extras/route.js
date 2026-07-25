/** 9router parity: GET /api/headroom/extras */
export async function GET() {
  return Response.json({
    extras: [],
    message: "No managed Headroom extras. Configure external Headroom independently.",
  });
}
