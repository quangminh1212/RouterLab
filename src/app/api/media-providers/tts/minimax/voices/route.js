/**
 * 9router parity: GET /api/media-providers/tts/minimax/voices
 */
export async function GET() {
  // Static catalog fallback when live Minimax credentials are not used
  const voices = [
    { id: "male-qn-qingse", name: "Qingse (Male)" },
    { id: "female-shaonv", name: "Shaonv (Female)" },
    { id: "presenter_male", name: "Presenter Male" },
    { id: "presenter_female", name: "Presenter Female" },
  ];
  return Response.json({ provider: "minimax", voices });
}
