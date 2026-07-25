export async function POST() {
  return Response.json({ success: true, managed: false, message: "No in-process pxpipe to stop." });
}
