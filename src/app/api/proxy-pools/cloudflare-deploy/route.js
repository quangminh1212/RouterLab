/** 9router parity: POST /api/proxy-pools/cloudflare-deploy */
export async function POST() {
  return Response.json({
    success: false,
    message:
      "Cloudflare Workers deploy for proxy pools is optional. Configure CLOUDFLARE_API_TOKEN + account, or deploy cloud/ wrangler package manually.",
    docs: "cloud/README.md",
  });
}
