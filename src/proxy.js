export { proxy } from "./dashboardGuard";

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/settings/:path*",
    "/api/keys/:path*",
    "/api/cli-tools/:path*",
    "/api/tunnel/:path*",
    "/api/proxy-pools/:path*",
    "/api/providers/:path*",
    "/api/provider-nodes/:path*",
    "/api/combos/:path*",
    "/api/basic-chat/state",
    "/api/usage/:path*",
    "/api/dashboard/bootstrap",
    "/api/debug/:path*",
    "/api/shutdown",
  ],
};
