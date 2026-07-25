export async function POST() {
  return Response.json({ success: false, managed: false, message: "Restart external pxpipe worker if deployed." });
}
