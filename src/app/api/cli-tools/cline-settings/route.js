import { handleCliToolSettingsGet, handleCliToolSettingsPost } from "../_lib/settingsStub.js";

export async function GET() {
  return handleCliToolSettingsGet("cline");
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return handleCliToolSettingsPost("cline", body);
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
