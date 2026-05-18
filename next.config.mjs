import path from "node:path";
import { fileURLToPath } from "node:url";

const hideDevIndicators = process.env.XLABROUTER_HIDE_NEXT_DEV_INDICATOR === "1";
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
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
  experimental: {
    optimizePackageImports: [
      "@monaco-editor/react",
      "monaco-editor",
      "recharts",
      "@xyflow/react",
      "zustand"
    ],
  },
  env: {},
  turbopack: {
    root: PROJECT_ROOT,
  },
  webpack: (config, { isServer }) => {
    if (isProd && !isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[/\\]node_modules[/\\](react|react-dom|scheduler|next)[/\\]/,
              priority: 50,
              enforce: true,
            },
            lib: {
              test(module) {
                return module.size() > 160000 && /node_modules/.test(module.identifier());
              },
              name(module) {
                const match = module.identifier().match(/[/\\]node_modules[/\\](?:\.pnpm[/\\])?(?:@[^/\\]+[/\\])?([^/\\]+)/);
                return match ? `lib-${match[1].replace(/[^a-zA-Z0-9_-]/g, '_')}` : 'lib';
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            monaco: {
              name: 'monaco',
              test: /[/\\]node_modules[/\\](monaco-editor|@monaco-editor)[/\\]/,
              chunks: 'async',
              priority: 40,
            },
            recharts: {
              name: 'recharts',
              test: /[/\\]node_modules[/\\](recharts)[/\\]/,
              chunks: 'async',
              priority: 35,
            },
            xyflow: {
              name: 'xyflow',
              test: /[/\\]node_modules[/\\](@xyflow)[/\\]/,
              chunks: 'async',
              priority: 35,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
              maxSize: 200000,
            },
          },
        },
        minimize: true,
      };
    }

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(PROJECT_ROOT, "src"),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/.next/**",
        "**/.openclaw/**",
        "**/.playwright-mcp/**",
        "**/logs/**",
        "**/*.log",
        "**/*.ndjson",
        "**/*.tmp",
        "**/.tmp-*/**",
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
