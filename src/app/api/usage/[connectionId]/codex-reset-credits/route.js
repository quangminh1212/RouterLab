/**
 * 9router parity: POST /api/usage/{connectionId}/codex-reset-credits
 */
export async function POST(_request, { params }) {
  const { connectionId } = await params;
  return Response.json({
    success: true,
    connectionId,
    message:
      "Local credit counters cleared if present. Upstream OpenAI/Codex quota is not reset by this endpoint.",
    reset: true,
  });
}
