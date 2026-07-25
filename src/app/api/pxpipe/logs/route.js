export async function GET() {
  return Response.json({ logs: [], message: "No managed pxpipe logs in-process." });
}
