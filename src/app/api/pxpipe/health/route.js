export async function GET() {
  return Response.json({ ok: true, component: "pxpipe", managed: false });
}
