export async function GET() {
  return Response.json({ requests: 0, managed: false });
}
