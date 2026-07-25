/**
 * 9router parity: POST /api/auth/reset-password
 * Local single-user mode: updates dashboard password when credentials module supports it.
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

async function postHandler(request) {
  const body = await request.json().catch(() => null);
  if (!body?.newPassword && !body?.password) {
    return Response.json(
      { error: { message: "newPassword is required", type: "invalid_request_error" } },
      { status: 400 }
    );
  }
  try {
    const creds = await import("@/lib/auth/credentials.js");
    if (typeof creds.setPassword === "function") {
      await creds.setPassword(body.newPassword || body.password, body.oldPassword);
      return Response.json({ success: true });
    }
    if (typeof creds.updatePassword === "function") {
      await creds.updatePassword(body.oldPassword, body.newPassword || body.password);
      return Response.json({ success: true });
    }
  } catch (err) {
    return Response.json(
      { error: { message: err.message || "Password reset failed", type: "auth_error" } },
      { status: 400 }
    );
  }
  return Response.json(
    {
      error: {
        message:
          "Password reset API not wired for this auth backend. Use dashboard Settings → Security.",
        type: "not_implemented",
      },
    },
    { status: 501 }
  );
}

export const POST = withRouteGuard("auth/reset-password", postHandler, { timeoutMs: 15000 });

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
