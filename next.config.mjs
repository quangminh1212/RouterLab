import path from "node:path";
import { fileURLToPath } from "node:url";

const hideDevIndicators = process.env.XLABROUTER_HIDE_NEXT_DEV_INDICATOR === "1";
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: hideDevIndicators ? false : undefined,
  allowedDevOrigins: [
    "api.xlabrnd.com",
    "*.xlabrnd.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  serverExternalPackages: ["better-sqlite3"],
  images: {
    unoptimized: true
  },
  env: {},
  turbopack: {
    root: PROJECT_ROOT,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(PROJECT_ROOT, "src"),
    };

    // Ignore fs/path modules in browser bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    // Ignore generated runtime artifacts so Next dev does not rebuild / full-reload
    // when local logs or temp files are updated continuously.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/.next/**",
        "**/logs/**",
        "**/*.log",
        "**/*.tmp",
        "**/tmp/**",
        "**/temp/**",
      ],
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/v1/v1/:path*",
        destination: "/api/v1/:path*"
      },
      {
        source: "/v1/v1",
        destination: "/api/v1"
      },
      {
        source: "/codex/:path*",
        destination: "/api/v1/responses"
      },
      {
        source: "/v1/:path*",
        destination: "/api/v1/:path*"
      },
      {
        source: "/v1",
        destination: "/api/v1"
      }
    ];
  }
};

export default nextConfig;
