export async function POST() {
  return Response.json({
    success: false,
    managed: false,
    message: "PxPipe start is not managed in-process. Use proxy-pools cloudflare/deno deploy APIs.",
  });
}
