/** 9router parity: POST /api/proxy-pools/deno-deploy */
export async function POST() {
  return Response.json({
    success: false,
    message: "Deno Deploy proxy pool deploy is optional. Use Deno dashboard or existing proxy-pools scripts.",
  });
}
