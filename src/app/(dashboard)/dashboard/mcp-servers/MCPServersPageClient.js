"use client";

import { useEffect, useMemo, useState } from "react";
import { CardSkeleton, Input, Modal, Toggle } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
};

const SOURCE_OPTIONS = [
  { id: "all", label: "All sources" },
  { id: "xlab-ready", label: "XLab ready" },
  { id: "mcpmarket", label: "MCPMarket" },
];

const MCP_ICON_URLS = {
  context7: "/mcp/icons/context7.png",
  playwright: "/mcp/icons/playwright.png",
  firecrawl: "/mcp/icons/firecrawl.png",
  browserbase: "/mcp/icons/browserbase.png",
  github: "/mcp/icons/github.png",
  filesystem: "/mcp/icons/filesystem.png",
  memory: "/mcp/icons/memory.png",
  "sequential-thinking": "/mcp/icons/sequential-thinking.png",
  "brave-search": "/mcp/icons/brave-search.png",
  tavily: "/mcp/icons/tavily.png",
  postgres: "/mcp/icons/postgres.png",
  puppeteer: "/mcp/icons/puppeteer.png",
  "openai-docs": "/mcp/icons/openai-docs.png",
  elevenlabs: "/mcp/icons/elevenlabs.png",
  fastapi: "/mcp/icons/fastapi.png",
  excel: "/mcp/icons/excel.png",
  "exa-search": "/mcp/icons/exa-search.png",
  "arxiv-mcp": "/mcp/icons/arxiv-mcp.png",
  "workspace-mcp": "/mcp/icons/workspace-mcp.png",
  "language-server": "/mcp/icons/language-server.png",
  "memory-bank": "/mcp/icons/memory-bank.png",
  "reddit-buddy": "/mcp/icons/reddit-buddy.png",
  "sentry-mcp": "/mcp/icons/sentry-mcp.png",
  "notion-mcp": "/mcp/icons/notion-mcp.png",
  "hubspot-mcp": "/mcp/icons/hubspot-mcp.png",
  "neon-mcp": "/mcp/icons/neon-mcp.png",
  "supabase-mcp": "/mcp/icons/supabase-mcp.png",
  "stripe-mcp": "/mcp/icons/stripe-mcp.png",
  "google-maps-mcp": "/mcp/icons/google-maps-mcp.png",
  "slack-mcp": "/mcp/icons/slack-mcp.png",
  "chrome-devtools": "/mcp/icons/chrome-devtools.png",
  apify: "/mcp/icons/apify.png",
  mapbox: "/mcp/icons/mapbox.png",
  railway: "/mcp/icons/railway.png",
  heroku: "/mcp/icons/heroku.png",
  browserstack: "/mcp/icons/browserstack.png",
  kubernetes: "/mcp/icons/kubernetes.png",
  datadog: "/mcp/icons/datadog.png",
  dynatrace: "/mcp/icons/dynatrace.png",
  ui5: "/mcp/icons/ui5.png",
  line: "/mcp/icons/line.png",
  cloudflare: "/mcp/icons/cloudflare.png",
  pulumi: "/mcp/icons/pulumi.png",
  elasticsearch: "/mcp/icons/elasticsearch.png",
  mongodb: "/mcp/icons/mongodb.png",
  pinecone: "/mcp/icons/pinecone.png",
  qdrant: "/mcp/icons/qdrant.png",
  mysql: "/mcp/icons/mysql.png",
  sqlite: "/mcp/icons/sqlite.png",
  docker: "/mcp/icons/docker.png",
  terraform: "/mcp/icons/terraform.png",
};

const MCP_CATALOG = [
  {
    id: "context7",
    name: "Context7 Docs",
    category: "Coding",
    source: "xlab-ready",
    icon: "menu_book",
    description: "Pull up-to-date docs and code examples for libraries and frameworks.",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@latest"],
    npmPackage: "@upstash/context7-mcp",
    sourceUrl: "https://github.com/upstash/context7",
    env: {},
  },
  {
    id: "playwright",
    name: "Playwright Browser",
    category: "Browser Automation",
    source: "xlab-ready",
    icon: "travel_explore",
    description: "Control a browser, inspect pages, fill forms, and collect screenshots.",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest", "--headless"],
    npmPackage: "@playwright/mcp",
    sourceUrl: "https://github.com/microsoft/playwright-mcp",
    env: {},
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "Web Scraping",
    source: "mcpmarket",
    icon: "local_fire_department",
    description: "Scrape, crawl, and search websites for clean LLM-ready content.",
    command: "npx",
    args: ["-y", "firecrawl-mcp"],
    npmPackage: "firecrawl-mcp",
    sourceUrl: "https://github.com/firecrawl/firecrawl-mcp-server",
    env: { FIRECRAWL_API_KEY: "" },
    requiredEnv: ["FIRECRAWL_API_KEY"],
  },
  {
    id: "browserbase",
    name: "Browserbase",
    category: "Browser Automation",
    source: "mcpmarket",
    icon: "cloud_queue",
    description: "Run cloud browser automation sessions with Browserbase and Stagehand.",
    command: "npx",
    args: ["@browserbasehq/mcp-server-browserbase"],
    npmPackage: "@browserbasehq/mcp-server-browserbase",
    sourceUrl: "https://github.com/browserbase/mcp-server-browserbase",
    env: { BROWSERBASE_API_KEY: "", BROWSERBASE_PROJECT_ID: "", GEMINI_API_KEY: "" },
    requiredEnv: ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"],
  },
  {
    id: "github",
    name: "GitHub",
    category: "Coding",
    source: "xlab-ready",
    icon: "code",
    description: "Work with repositories, issues, pull requests, and code search.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github@latest"],
    npmPackage: "@modelcontextprotocol/server-github",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    requiredEnv: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    category: "Local Tools",
    source: "xlab-ready",
    icon: "folder_open",
    description: "Read and write files inside a configured project directory.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem@latest", "${PROJECT_DIR}"],
    npmPackage: "@modelcontextprotocol/server-filesystem",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    env: { PROJECT_DIR: "" },
    requiredEnv: ["PROJECT_DIR"],
  },
  {
    id: "memory",
    name: "Memory Graph",
    category: "Local Tools",
    source: "xlab-ready",
    icon: "account_tree",
    description: "Store and retrieve local knowledge graph memory for agents.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory@latest"],
    npmPackage: "@modelcontextprotocol/server-memory",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    env: {},
  },
  {
    id: "sequential-thinking",
    name: "Sequential Thinking",
    category: "Reasoning",
    source: "xlab-ready",
    icon: "psychology",
    description: "Break complex tasks into structured dynamic reasoning steps.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking@latest"],
    npmPackage: "@modelcontextprotocol/server-sequential-thinking",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    env: {},
  },
  {
    id: "brave-search",
    name: "Brave Search",
    category: "Search",
    source: "xlab-ready",
    icon: "search",
    description: "Search the web with Brave Search API from MCP tools.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search@latest"],
    npmPackage: "@modelcontextprotocol/server-brave-search",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    env: { BRAVE_API_KEY: "" },
    requiredEnv: ["BRAVE_API_KEY"],
  },
  {
    id: "tavily",
    name: "Tavily Search",
    category: "Search",
    source: "xlab-ready",
    icon: "manage_search",
    description: "Use Tavily web search for agent research and answer grounding.",
    command: "npx",
    args: ["-y", "tavily-mcp@latest"],
    npmPackage: "tavily-mcp",
    sourceUrl: "https://github.com/tavily-ai/tavily-mcp",
    env: { TAVILY_API_KEY: "" },
    requiredEnv: ["TAVILY_API_KEY"],
  },
  {
    id: "postgres",
    name: "Postgres",
    category: "Database",
    source: "xlab-ready",
    icon: "database",
    description: "Expose a PostgreSQL database safely through MCP tools.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres@latest", "${POSTGRES_CONNECTION_STRING}"],
    npmPackage: "@modelcontextprotocol/server-postgres",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    env: { POSTGRES_CONNECTION_STRING: "" },
    requiredEnv: ["POSTGRES_CONNECTION_STRING"],
  },
  {
    id: "puppeteer",
    name: "Puppeteer Browser",
    category: "Browser Automation",
    source: "xlab-ready",
    icon: "smart_display",
    description: "Automate Chromium pages through Puppeteer-backed MCP tools.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer@latest"],
    npmPackage: "@modelcontextprotocol/server-puppeteer",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    env: {},
  },
  {
    id: "openai-docs",
    name: "OpenAI Developer Docs",
    category: "Coding",
    source: "xlab-ready",
    icon: "article",
    description: "Connect OpenAI developer documentation as an MCP endpoint.",
    endpoint: "https://developers.openai.com/mcp",
    sourceUrl: "https://developers.openai.com/codex/mcp",
    env: {},
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "Media",
    source: "mcpmarket",
    icon: "graphic_eq",
    description: "Use text-to-speech and audio APIs from ElevenLabs workflows.",
    command: "npx",
    args: ["-y", "elevenlabs-mcp"],
    npmPackage: "elevenlabs-mcp",
    sourceUrl: "https://mcpmarket.com/",
    env: { ELEVENLABS_API_KEY: "" },
    requiredEnv: ["ELEVENLABS_API_KEY"],
  },
  {
    id: "fastapi",
    name: "FastAPI",
    category: "API Development",
    source: "mcpmarket",
    icon: "api",
    description: "Expose FastAPI endpoints as MCP tools for local app workflows.",
    command: "python",
    args: ["-m", "fastapi_mcp"],
    sourceUrl: "https://mcpmarket.com/",
    env: { FASTAPI_APP: "" },
    requiredEnv: ["FASTAPI_APP"],
  },
  {
    id: "excel",
    name: "Excel",
    category: "Productivity",
    source: "mcpmarket",
    icon: "grid_on",
    description: "Manipulate spreadsheet files without opening Microsoft Excel.",
    command: "npx",
    args: ["-y", "excel-mcp-server"],
    npmPackage: "excel-mcp-server",
    sourceUrl: "https://mcpmarket.com/",
    env: {},
  },
  {
    id: "exa-search",
    name: "Exa Search",
    category: "Search",
    source: "mcpmarket",
    icon: "travel_explore",
    description: "High-quality web search and crawling via Exa MCP server.",
    command: "npx",
    args: ["-y", "exa-mcp-server"],
    npmPackage: "exa-mcp-server",
    sourceUrl: "https://github.com/exa-labs/exa-mcp-server",
    env: { EXA_API_KEY: "" },
    requiredEnv: ["EXA_API_KEY"],
  },
  {
    id: "arxiv-mcp",
    name: "arXiv Research",
    category: "Research",
    source: "mcpmarket",
    icon: "science",
    description: "Search and analyze arXiv papers from MCP clients.",
    command: "npx",
    args: ["-y", "arxiv-mcp-server"],
    npmPackage: "arxiv-mcp-server",
    sourceUrl: "https://github.com/blazickjp/arxiv-mcp-server",
    env: {},
  },
  {
    id: "workspace-mcp",
    name: "Google Workspace",
    category: "Productivity",
    source: "mcpmarket",
    icon: "workspaces",
    description: "Control Gmail, Calendar, Docs, Sheets, Drive and more.",
    command: "uvx",
    args: ["workspace-mcp", "--tool-tier", "core"],
    sourceUrl: "https://github.com/taylorwilsdon/google_workspace_mcp",
    env: { GOOGLE_OAUTH_CLIENT_ID: "", GOOGLE_OAUTH_CLIENT_SECRET: "" },
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  },
  {
    id: "language-server",
    name: "Language Server",
    category: "Coding",
    source: "mcpmarket",
    icon: "code_blocks",
    description: "Semantic code tools (go to definition, references, symbols) via LSP.",
    command: "npx",
    args: ["-y", "mcp-language-server"],
    npmPackage: "mcp-language-server",
    sourceUrl: "https://github.com/isaacphi/mcp-language-server",
    env: {},
  },
  {
    id: "memory-bank",
    name: "Memory Bank",
    category: "Local Tools",
    source: "mcpmarket",
    icon: "database",
    description: "Persistent memory bank for long-running agent workflows.",
    command: "npx",
    args: ["-y", "memory-bank-mcp"],
    npmPackage: "memory-bank-mcp",
    sourceUrl: "https://github.com/alioshr/memory-bank-mcp",
    env: { MEMORY_BANK_ROOT: "" },
  },
  {
    id: "reddit-buddy",
    name: "Reddit MCP Buddy",
    category: "Research",
    source: "mcpmarket",
    icon: "forum",
    description: "Browse and analyze Reddit content from MCP clients.",
    command: "npx",
    args: ["-y", "reddit-mcp-buddy"],
    npmPackage: "reddit-mcp-buddy",
    sourceUrl: "https://github.com/karanb192/reddit-mcp-buddy",
    env: {},
  },
  {
    id: "sentry-mcp",
    name: "Sentry",
    category: "Observability",
    source: "mcpmarket",
    icon: "monitoring",
    description: "Inspect Sentry errors, issues, releases, and alerts from MCP.",
    command: "npx",
    args: ["-y", "@sentry/mcp-server"],
    npmPackage: "@sentry/mcp-server",
    sourceUrl: "https://github.com/getsentry/sentry-mcp",
    env: { SENTRY_AUTH_TOKEN: "" },
    requiredEnv: ["SENTRY_AUTH_TOKEN"],
  },
  {
    id: "notion-mcp",
    name: "Notion Official",
    category: "Productivity",
    source: "mcpmarket",
    icon: "note_stack",
    description: "Access Notion pages and databases via official MCP server.",
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    npmPackage: "@notionhq/notion-mcp-server",
    sourceUrl: "https://github.com/makenotion/notion-mcp-server",
    env: { NOTION_API_KEY: "" },
    requiredEnv: ["NOTION_API_KEY"],
  },
  {
    id: "hubspot-mcp",
    name: "HubSpot Official",
    category: "CRM",
    source: "mcpmarket",
    icon: "support_agent",
    description: "Query contacts, companies, tickets and CRM objects in HubSpot.",
    command: "npx",
    args: ["-y", "@hubspot/mcp-server"],
    npmPackage: "@hubspot/mcp-server",
    sourceUrl: "https://github.com/HubSpot/mcp-server",
    env: { HUBSPOT_ACCESS_TOKEN: "" },
    requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],
  },
  {
    id: "neon-mcp",
    name: "Neon Postgres",
    category: "Database",
    source: "mcpmarket",
    icon: "storage",
    description: "Manage and query Neon Postgres from MCP clients.",
    command: "npx",
    args: ["-y", "@neondatabase/mcp-server-neon"],
    npmPackage: "@neondatabase/mcp-server-neon",
    sourceUrl: "https://github.com/neondatabase/mcp-server-neon",
    env: { NEON_API_KEY: "" },
    requiredEnv: ["NEON_API_KEY"],
  },
  {
    id: "supabase-mcp",
    name: "Supabase Official",
    category: "Database",
    source: "mcpmarket",
    icon: "deployed_code",
    description: "Work with Supabase projects, database, auth and storage via MCP.",
    command: "npx",
    args: ["-y", "@supabase/mcp-server-supabase"],
    npmPackage: "@supabase/mcp-server-supabase",
    sourceUrl: "https://github.com/supabase-community/supabase-mcp",
    env: { SUPABASE_ACCESS_TOKEN: "" },
    requiredEnv: ["SUPABASE_ACCESS_TOKEN"],
  },
  {
    id: "stripe-mcp",
    name: "Stripe Official",
    category: "Payments",
    source: "mcpmarket",
    icon: "payments",
    description: "Explore Stripe resources, balances, customers and payment flows.",
    command: "npx",
    args: ["-y", "@stripe/mcp"],
    npmPackage: "@stripe/mcp",
    sourceUrl: "https://github.com/stripe/agent-toolkit",
    env: { STRIPE_API_KEY: "" },
    requiredEnv: ["STRIPE_API_KEY"],
  },
  {
    id: "google-maps-mcp",
    name: "Google Maps",
    category: "Maps",
    source: "xlab-ready",
    icon: "map",
    description: "Use geocoding, places, routes and map data from Google Maps MCP.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps@latest"],
    npmPackage: "@modelcontextprotocol/server-google-maps",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps",
    env: { GOOGLE_MAPS_API_KEY: "" },
    requiredEnv: ["GOOGLE_MAPS_API_KEY"],
  },
  {
    id: "slack-mcp",
    name: "Slack Official",
    category: "Communication",
    source: "xlab-ready",
    icon: "chat",
    description: "Read channels, post messages, and manage Slack workspace context.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack@latest"],
    npmPackage: "@modelcontextprotocol/server-slack",
    sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    env: { SLACK_BOT_TOKEN: "" },
    requiredEnv: ["SLACK_BOT_TOKEN"],
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    category: "Browser Automation",
    source: "mcpmarket",
    icon: "web_asset",
    description: "Official Chrome DevTools MCP for browser debugging and performance inspection.",
    command: "npx",
    args: ["-y", "chrome-devtools-mcp"],
    npmPackage: "chrome-devtools-mcp",
    sourceUrl: "https://github.com/ChromeDevTools/chrome-devtools-mcp",
    env: {},
  },
  {
    id: "apify",
    name: "Apify Actors",
    category: "Web Scraping",
    source: "mcpmarket",
    icon: "deployed_code",
    description: "Run Apify Actors and web automation workflows from MCP clients.",
    command: "npx",
    args: ["-y", "@apify/actors-mcp-server"],
    npmPackage: "@apify/actors-mcp-server",
    sourceUrl: "https://github.com/apify/apify-mcp-server",
    env: { APIFY_TOKEN: "" },
    requiredEnv: ["APIFY_TOKEN"],
  },
  {
    id: "mapbox",
    name: "Mapbox Official",
    category: "Maps",
    source: "mcpmarket",
    icon: "map",
    description: "Use Mapbox geocoding, maps, and location APIs through MCP.",
    command: "npx",
    args: ["-y", "@mapbox/mcp-server"],
    npmPackage: "@mapbox/mcp-server",
    sourceUrl: "https://github.com/mapbox/mcp-server",
    env: { MAPBOX_ACCESS_TOKEN: "" },
    requiredEnv: ["MAPBOX_ACCESS_TOKEN"],
  },
  {
    id: "railway",
    name: "Railway Official",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "train",
    description: "Manage Railway projects, services, environments, and deployments.",
    command: "npx",
    args: ["-y", "@railway/mcp-server"],
    npmPackage: "@railway/mcp-server",
    sourceUrl: "https://docs.railway.com/reference/mcp-server",
    env: { RAILWAY_API_TOKEN: "" },
    requiredEnv: ["RAILWAY_API_TOKEN"],
  },
  {
    id: "heroku",
    name: "Heroku Official",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "cloud_upload",
    description: "Operate Heroku apps, add-ons, config vars, and platform resources.",
    command: "npx",
    args: ["-y", "@heroku/mcp-server"],
    npmPackage: "@heroku/mcp-server",
    sourceUrl: "https://github.com/heroku/heroku-mcp-server",
    env: { HEROKU_API_KEY: "" },
    requiredEnv: ["HEROKU_API_KEY"],
  },
  {
    id: "browserstack",
    name: "BrowserStack Official",
    category: "Testing",
    source: "mcpmarket",
    icon: "bug_report",
    description: "Run browser and app testing workflows through BrowserStack MCP.",
    command: "npx",
    args: ["-y", "@browserstack/mcp-server"],
    npmPackage: "@browserstack/mcp-server",
    sourceUrl: "https://github.com/browserstack/mcp-server",
    env: { BROWSERSTACK_USERNAME: "", BROWSERSTACK_ACCESS_KEY: "" },
    requiredEnv: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "hub",
    description: "Interact with Kubernetes clusters via kubectl-backed MCP tools.",
    command: "npx",
    args: ["-y", "mcp-server-kubernetes"],
    npmPackage: "mcp-server-kubernetes",
    sourceUrl: "https://github.com/containers/kubernetes-mcp-server",
    env: {},
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "Observability",
    source: "mcpmarket",
    icon: "monitoring",
    description: "Inspect Datadog metrics, logs, dashboards, and monitors.",
    command: "npx",
    args: ["-y", "@winor30/mcp-server-datadog"],
    npmPackage: "@winor30/mcp-server-datadog",
    sourceUrl: "https://github.com/winor30/mcp-server-datadog",
    env: { DATADOG_API_KEY: "", DATADOG_APP_KEY: "" },
    requiredEnv: ["DATADOG_API_KEY", "DATADOG_APP_KEY"],
  },
  {
    id: "dynatrace",
    name: "Dynatrace Official",
    category: "Observability",
    source: "mcpmarket",
    icon: "query_stats",
    description: "Use Dynatrace observability data and platform automation through MCP.",
    command: "npx",
    args: ["-y", "@dynatrace-oss/dynatrace-mcp-server"],
    npmPackage: "@dynatrace-oss/dynatrace-mcp-server",
    sourceUrl: "https://github.com/dynatrace-oss/dynatrace-mcp-server",
    env: { DT_ENVIRONMENT: "", DT_API_TOKEN: "" },
    requiredEnv: ["DT_ENVIRONMENT", "DT_API_TOKEN"],
  },
  {
    id: "ui5",
    name: "SAP UI5",
    category: "Coding",
    source: "mcpmarket",
    icon: "widgets",
    description: "MCP tools for SAPUI5/OpenUI5 application development.",
    command: "npx",
    args: ["-y", "@ui5/mcp-server"],
    npmPackage: "@ui5/mcp-server",
    sourceUrl: "https://www.npmjs.com/package/@ui5/mcp-server",
    env: {},
  },
  {
    id: "line",
    name: "LINE Bot",
    category: "Communication",
    source: "mcpmarket",
    icon: "chat_bubble",
    description: "Build and manage LINE Bot messaging workflows via MCP.",
    command: "npx",
    args: ["-y", "@line/line-bot-mcp-server"],
    npmPackage: "@line/line-bot-mcp-server",
    sourceUrl: "https://www.npmjs.com/package/@line/line-bot-mcp-server",
    env: { CHANNEL_ACCESS_TOKEN: "" },
    requiredEnv: ["CHANNEL_ACCESS_TOKEN"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "cloud",
    description: "Manage Cloudflare accounts and developer platform resources.",
    command: "npx",
    args: ["-y", "@cloudflare/mcp-server-cloudflare"],
    npmPackage: "@cloudflare/mcp-server-cloudflare",
    sourceUrl: "https://www.npmjs.com/package/@cloudflare/mcp-server-cloudflare",
    env: { CLOUDFLARE_API_TOKEN: "" },
    requiredEnv: ["CLOUDFLARE_API_TOKEN"],
  },
  {
    id: "pulumi",
    name: "Pulumi",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "deployed_code_update",
    description: "Query and automate Pulumi infrastructure resources from MCP.",
    command: "npx",
    args: ["-y", "@pulumi/mcp-server"],
    npmPackage: "@pulumi/mcp-server",
    sourceUrl: "https://www.npmjs.com/package/@pulumi/mcp-server",
    env: { PULUMI_ACCESS_TOKEN: "" },
    requiredEnv: ["PULUMI_ACCESS_TOKEN"],
  },
  {
    id: "elasticsearch",
    name: "Elasticsearch",
    category: "Database",
    source: "mcpmarket",
    icon: "manage_search",
    description: "Search and inspect Elasticsearch clusters with MCP tools.",
    command: "npx",
    args: ["-y", "@elastic/mcp-server-elasticsearch"],
    npmPackage: "@elastic/mcp-server-elasticsearch",
    sourceUrl: "https://www.npmjs.com/package/@elastic/mcp-server-elasticsearch",
    env: { ELASTICSEARCH_URL: "", ELASTICSEARCH_API_KEY: "" },
    requiredEnv: ["ELASTICSEARCH_URL", "ELASTICSEARCH_API_KEY"],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "Database",
    source: "mcpmarket",
    icon: "database",
    description: "Connect MongoDB databases and Atlas workflows to MCP clients.",
    command: "npx",
    args: ["-y", "mongodb-mcp-server"],
    npmPackage: "mongodb-mcp-server",
    sourceUrl: "https://www.npmjs.com/package/mongodb-mcp-server",
    env: { MDB_MCP_CONNECTION_STRING: "" },
    requiredEnv: ["MDB_MCP_CONNECTION_STRING"],
  },
  {
    id: "pinecone",
    name: "Pinecone",
    category: "Database",
    source: "mcpmarket",
    icon: "hub",
    description: "Query and manage Pinecone vector indexes through MCP.",
    command: "npx",
    args: ["-y", "pinecone-mcp"],
    npmPackage: "pinecone-mcp",
    sourceUrl: "https://www.npmjs.com/package/pinecone-mcp",
    env: { PINECONE_API_KEY: "" },
    requiredEnv: ["PINECONE_API_KEY"],
  },
  {
    id: "qdrant",
    name: "Qdrant",
    category: "Database",
    source: "mcpmarket",
    icon: "hub",
    description: "Official-style Qdrant vector database MCP integration.",
    command: "npx",
    args: ["-y", "qdrant-mcp-server"],
    npmPackage: "qdrant-mcp-server",
    sourceUrl: "https://github.com/qdrant/mcp-server-qdrant",
    env: { QDRANT_URL: "", QDRANT_API_KEY: "" },
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "Database",
    source: "mcpmarket",
    icon: "database",
    description: "Inspect and query MySQL databases through MCP.",
    command: "npx",
    args: ["-y", "mysql-mcp-server"],
    npmPackage: "mysql-mcp-server",
    sourceUrl: "https://www.npmjs.com/package/mysql-mcp-server",
    env: { MYSQL_HOST: "", MYSQL_USER: "", MYSQL_PASSWORD: "", MYSQL_DATABASE: "" },
    requiredEnv: ["MYSQL_HOST", "MYSQL_USER", "MYSQL_DATABASE"],
  },
  {
    id: "sqlite",
    name: "SQLite",
    category: "Database",
    source: "mcpmarket",
    icon: "database",
    description: "Query local SQLite databases from MCP clients.",
    command: "npx",
    args: ["-y", "sqlite-mcp-server"],
    npmPackage: "sqlite-mcp-server",
    sourceUrl: "https://www.npmjs.com/package/sqlite-mcp-server",
    env: { SQLITE_DB_PATH: "" },
    requiredEnv: ["SQLITE_DB_PATH"],
  },
  {
    id: "docker",
    name: "Docker",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "deployed_code",
    description: "Control Docker containers, images, and local development environments.",
    command: "npx",
    args: ["-y", "docker-mcp-server"],
    npmPackage: "docker-mcp-server",
    sourceUrl: "https://www.npmjs.com/package/docker-mcp-server",
    env: {},
  },
  {
    id: "terraform",
    name: "Terraform",
    category: "Infrastructure",
    source: "mcpmarket",
    icon: "account_tree",
    description: "Read and manage Terraform workflows through MCP tools.",
    command: "npx",
    args: ["-y", "terraform-mcp-server"],
    npmPackage: "terraform-mcp-server",
    sourceUrl: "https://www.npmjs.com/package/terraform-mcp-server",
    env: {},
  },
];

function cloneAiIntegrations(value) {
  const source = value && typeof value === "object" ? value : EMPTY_AI_INTEGRATIONS;
  return {
    enabled: source.enabled === true,
    autoConnect: source.autoConnect === true,
    mcpServers: Array.isArray(source.mcpServers) ? source.mcpServers.map((item) => ({ ...item })) : [],
    plugins: Array.isArray(source.plugins) ? source.plugins.map((item) => ({ ...item })) : [],
  };
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string" && value.trim()) return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return asPlainObject(parsed);
  } catch {
    return {};
  }
}

function stringifyJsonObject(value) {
  const object = asPlainObject(value);
  return Object.keys(object).length > 0 ? JSON.stringify(object, null, 2) : "";
}

function normalizeServer(item, index = 0) {
  const id = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : `server-${index + 1}`;
  return {
    id,
    name: typeof item?.name === "string" && item.name.trim() ? item.name.trim() : id,
    source: typeof item?.source === "string" ? item.source.trim() : "",
    sourceUrl: typeof item?.sourceUrl === "string" ? item.sourceUrl.trim() : "",
    npmPackage: typeof item?.npmPackage === "string" ? item.npmPackage.trim() : "",
    description: typeof item?.description === "string" ? item.description.trim() : "",
    endpoint: typeof item?.endpoint === "string" ? item.endpoint.trim() : "",
    apiKey: typeof item?.apiKey === "string" ? item.apiKey : "",
    command: typeof item?.command === "string" ? item.command.trim() : "",
    args: toStringArray(item?.args),
    env: parseJsonObject(item?.env),
    headers: parseJsonObject(item?.headers),
    enabledTools: toStringArray(item?.enabledTools),
    disabledTools: toStringArray(item?.disabledTools),
    envVars: toStringArray(item?.envVars),
    cwd: typeof item?.cwd === "string" ? item.cwd.trim() : "",
    bearerTokenEnvVar: typeof item?.bearerTokenEnvVar === "string" ? item.bearerTokenEnvVar.trim() : "",
    required: item?.required === true,
    startupTimeoutSec: Number.isFinite(Number(item?.startupTimeoutSec)) ? Number(item.startupTimeoutSec) : 20,
    toolTimeoutSec: Number.isFinite(Number(item?.toolTimeoutSec)) ? Number(item.toolTimeoutSec) : 120,
    enabled: item?.enabled === true,
  };
}

function catalogToServer(item) {
  return normalizeServer({
    id: item.id,
    name: item.name,
    source: item.category,
    sourceUrl: item.sourceUrl,
    npmPackage: item.npmPackage || "",
    description: item.description || "",
    endpoint: item.endpoint || "",
    command: item.command || "",
    args: item.args || [],
    env: item.env || {},
    headers: {},
    enabledTools: [],
    disabledTools: [],
    envVars: item.requiredEnv || [],
    enabled: true,
  });
}

function needsConfig(server, catalogItem) {
  const required = catalogItem?.requiredEnv || server?.envVars || [];
  return required.some((key) => !server?.env?.[key]);
}

function commandSummary(server) {
  if (server.command) return `${server.command} ${server.args.join(" ")}`.trim();
  if (server.endpoint) return server.endpoint;
  return server.source || server.id;
}

function serverDescription(server) {
  if (typeof server?.description === "string" && server.description.trim()) return server.description.trim();
  if (server?.endpoint) return "Connects to a remote MCP endpoint using HTTP/SSE.";
  if (server?.command) return "Runs a local MCP server command and exposes its tools to agents.";
  return "Custom MCP server configuration.";
}

function serverDetails(server) {
  const details = [];
  if (server?.source) details.push(server.source);
  if (server?.npmPackage) details.push(server.npmPackage);
  if (server?.endpoint) details.push("Remote endpoint");
  if (server?.command) details.push("Local command");
  if (Array.isArray(server?.envVars) && server.envVars.length > 0) details.push(`${server.envVars.length} required env`);
  return details;
}

function getMcpIconUrl(item) {
  if (typeof item?.iconUrl === "string" && item.iconUrl.trim()) return item.iconUrl.trim();
  return MCP_ICON_URLS[item?.id] || "";
}

function McpIcon({ item }) {
  const [failed, setFailed] = useState(false);
  const iconUrl = getMcpIconUrl(item);

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt={item.name}
        className="h-7 w-7 object-contain"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className="material-symbols-outlined text-[20px] text-[#0F1D20]">{item.icon}</span>;
}

export default function MCPServersPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [servers, setServers] = useState([]);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingServerId, setSavingServerId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [editModal, setEditModal] = useState({ open: false, server: null, index: -1 });
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = cloneAiIntegrations(data?.aiIntegrations);
        setAiForm(next);
        setServers(next.mcpServers.map(normalizeServer));
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load MCP servers" }))
      .finally(() => setLoading(false));
  }, []);

  const serverById = useMemo(() => new Map(servers.map((server, index) => [server.id, { server, index }])), [servers]);

  const categoryOptions = useMemo(() => {
    const sourceFiltered = sourceFilter === "all" ? MCP_CATALOG : MCP_CATALOG.filter((item) => item.source === sourceFilter);
    return ["all", ...Array.from(new Set(sourceFiltered.map((item) => item.category))).sort()];
  }, [sourceFilter]);

  const filteredCatalog = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return MCP_CATALOG.filter((item) => {
      const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const text = `${item.name} ${item.description} ${item.category} ${item.id}`.toLowerCase();
      return matchesSource && matchesCategory && (!keyword || text.includes(keyword));
    });
  }, [categoryFilter, query, sourceFilter]);

  const groupedCatalog = useMemo(() => {
    const groups = new Map();
    for (const item of filteredCatalog) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    return Array.from(groups.entries());
  }, [filteredCatalog]);

  const enabledCatalogCount = useMemo(
    () => MCP_CATALOG.filter((item) => serverById.get(item.id)?.server?.enabled === true).length,
    [serverById]
  );

  const customServers = useMemo(
    () => servers.filter((server) => !MCP_CATALOG.some((item) => item.id === server.id)),
    [servers]
  );

  const saveServers = async (newServers, successMessage = "Saved successfully") => {
    const nextForm = { ...aiForm, mcpServers: newServers };
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiIntegrations: nextForm }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to save settings");
    setAiForm(nextForm);
    setServers(newServers);
    setStatus({ type: "success", message: successMessage });
  };

  const toggleCatalogServer = async (item) => {
    setSavingServerId(item.id);
    setStatus({ type: "", message: "" });
    try {
      const existing = serverById.get(item.id);
      const updated = [...servers];
      if (existing) {
        updated[existing.index] = { ...existing.server, enabled: !existing.server.enabled };
      } else {
        updated.push(catalogToServer(item));
      }
      const nextEnabled = existing ? !existing.server.enabled : true;
      const message = nextEnabled
        ? `${item.name} enabled${needsConfig(updated[existing?.index ?? updated.length - 1], item) ? ". Add required env to finish setup." : ""}`
        : `${item.name} disabled`;
      await saveServers(updated, message);
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Failed to update MCP server" });
    } finally {
      setSavingServerId("");
    }
  };

  const openEditModal = (server, index) => {
    setEditModal({ open: true, server: { ...server, env: { ...server.env }, headers: { ...server.headers } }, index });
    setJsonMode(false);
    setJsonText(JSON.stringify(server, null, 2));
    setJsonError("");
  };

  const addCustomServer = () => {
    const server = normalizeServer({ id: `custom-${servers.length + 1}`, name: "Custom MCP Server", command: "npx", args: ["-y", ""], env: {}, enabled: true }, servers.length);
    setEditModal({ open: true, server, index: -1 });
    setJsonMode(false);
    setJsonText(JSON.stringify(server, null, 2));
    setJsonError("");
  };

  const closeEditModal = () => {
    setEditModal({ open: false, server: null, index: -1 });
    setJsonMode(false);
    setJsonText("");
    setJsonError("");
  };

  const saveEditModal = async () => {
    setJsonError("");
    try {
      let serverToSave = editModal.server;
      if (jsonMode) {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setJsonError("JSON must be an object");
          return;
        }
        serverToSave = parsed;
      }

      const updated = [...servers];
      if (editModal.index >= 0) updated[editModal.index] = normalizeServer(serverToSave, editModal.index);
      else updated.push(normalizeServer(serverToSave, updated.length));
      await saveServers(updated, "MCP server saved");
      closeEditModal();
    } catch (error) {
      if (jsonMode) setJsonError(error?.message || "Invalid JSON");
      else setStatus({ type: "error", message: error?.message || "Save failed" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[42px] leading-tight font-semibold text-text-main">Make MCP work your way</h1>
          <p className="text-text-muted mt-2">
            Enable ready-to-use MCP servers inside XLab Router. Presets are curated from XLab defaults and MCPMarket.
          </p>
          <a href="https://mcpmarket.com/" target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm text-primary hover:underline">
            Browse MCPMarket reference
          </a>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            className="flex-1 min-w-[260px]"
            label="Search MCP servers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search filesystem, browser, github, firecrawl..."
          />

          <div className="min-w-[220px]">
            <label className="text-sm font-medium text-text-main">Source</label>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setCategoryFilter("all");
              }}
              className="mt-2 w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm text-text-main outline-none focus:border-primary dark:border-white/10"
            >
              {SOURCE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id} className="bg-[#111]">
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px]">
            <label className="text-sm font-medium text-text-main">Category</label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm text-text-main outline-none focus:border-primary dark:border-white/10"
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item} className="bg-[#111]">
                  {item === "all" ? "All" : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-text-muted">Enabled MCP servers</p>
              <p className="text-xl font-semibold text-text-main">{enabledCatalogCount}/{MCP_CATALOG.length}</p>
            </div>
            <button
              type="button"
              onClick={addCustomServer}
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm text-text-main hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add custom
            </button>
          </div>
        </div>

        {loading ? (
          <CardSkeleton />
        ) : groupedCatalog.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-5 text-sm text-text-muted dark:border-white/10">No MCP servers match current filters.</div>
        ) : (
          <div className="space-y-8">
            {groupedCatalog.map(([category, items]) => (
              <section key={category} className="space-y-3">
                <h2 className="text-[30px] font-semibold text-text-main">{category}</h2>
                <div className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {items.map((item) => {
                    const existing = serverById.get(item.id);
                    const server = existing?.server;
                    const enabled = server?.enabled === true;
                    const configNeeded = server ? needsConfig(server, item) : Boolean(item.requiredEnv?.length);
                    const saving = savingServerId === item.id;
                    const infoUrl = item.sourceUrl || "";
                    return (
                      <div key={item.id} className="flex items-start gap-4 px-4 py-4">
                        {infoUrl ? (
                          <a
                            href={infoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 flex-1 items-start gap-4 rounded-lg -m-2 p-2 hover:bg-black/5 dark:hover:bg-white/5"
                            title={`Open ${item.name} information`}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-text-main">
                              <McpIcon item={item} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold text-text-main">{item.name}</p>
                                {enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                                {configNeeded ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500">Needs setup</span> : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Ready</span>}
                                <span
                                  className="rounded-full border border-black/10 px-2 py-0.5 text-[11px] text-text-muted hover:text-text-main dark:border-white/10"
                                  title="Open MCP server information"
                                >
                                  info
                                </span>
                              </div>
                              <p className="text-sm text-text-muted line-clamp-2">{item.description}</p>
                              <p className="mt-2 truncate font-mono text-xs text-text-muted">{commandSummary(server || catalogToServer(item))}</p>
                            </div>
                          </a>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-text-main">
                              <McpIcon item={item} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold text-text-main">{item.name}</p>
                                {enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                                {configNeeded ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500">Needs setup</span> : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Ready</span>}
                              </div>
                              <p className="text-sm text-text-muted line-clamp-2">{item.description}</p>
                              <p className="mt-2 truncate font-mono text-xs text-text-muted">{commandSummary(server || catalogToServer(item))}</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-1 flex items-center gap-2">
                          {server ? (
                            <button
                              type="button"
                              onClick={() => openEditModal(server, existing.index)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-text-main hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                              title="Configure MCP server"
                            >
                              <span className="material-symbols-outlined text-[18px]">settings</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleCatalogServer(item)}
                            disabled={saving || Boolean(savingServerId)}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                              enabled
                                ? "border-green-500/40 bg-green-500/10 text-green-500"
                                : "border-black/20 text-text-main hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
                              (saving || Boolean(savingServerId)) && "opacity-60"
                            )}
                            title={enabled ? "Disable MCP server" : "Enable MCP server"}
                          >
                            <span className="material-symbols-outlined text-[18px]">{enabled ? "check" : "add"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {customServers.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-[30px] font-semibold text-text-main">Custom</h2>
            <div className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
              {customServers.map((server) => {
                const index = servers.findIndex((item) => item.id === server.id);
                const details = serverDetails(server);
                const desc = serverDescription(server);
                return (
                  <div key={server.id} className="flex items-center gap-4 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-text-main">{server.name}</p>
                        {server.enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                        {details.length > 0 ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{details[0]}</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-text-muted line-clamp-2">{desc}</p>
                      <p className="truncate font-mono text-xs text-text-muted">{commandSummary(server)}</p>
                    </div>
                    <button type="button" onClick={() => openEditModal(server, index)} className="text-text-muted hover:text-text-main">
                      <span className="material-symbols-outlined text-[20px]">settings</span>
                    </button>
                    <Toggle
                      checked={server.enabled}
                      onChange={async () => {
                        const updated = [...servers];
                        updated[index] = { ...server, enabled: !server.enabled };
                        try {
                          await saveServers(updated, `${server.name} ${server.enabled ? "disabled" : "enabled"}`);
                        } catch (error) {
                          setStatus({ type: "error", message: error?.message || "Failed to update MCP server" });
                        }
                      }}
                      size="md"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {status.message ? <p className={cn("text-sm", status.type === "error" ? "text-red-500" : "text-green-500")}>{status.message}</p> : null}
      </div>

      {editModal.open && (
        <Modal isOpen={editModal.open} onClose={closeEditModal} title={editModal.index >= 0 ? "Configure MCP Server" : "Add Custom MCP Server"}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-2 dark:border-white/10">
              <span className="text-sm text-text-muted">Edit mode</span>
              <div className="flex items-center gap-2">
                <button type="button" className={cn("rounded px-3 py-1.5 text-xs", !jsonMode ? "bg-primary text-white" : "bg-surface text-text-muted")} onClick={() => { setJsonMode(false); setJsonError(""); }}>
                  Form
                </button>
                <button type="button" className={cn("rounded px-3 py-1.5 text-xs", jsonMode ? "bg-primary text-white" : "bg-surface text-text-muted")} onClick={() => { setJsonMode(true); setJsonText(JSON.stringify(editModal.server, null, 2)); setJsonError(""); }}>
                  JSON
                </button>
              </div>
            </div>

            {jsonMode ? (
              <div>
                <textarea
                  value={jsonText}
                  onChange={(event) => setJsonText(event.target.value)}
                  className="min-h-[360px] w-full rounded-lg border border-black/10 bg-transparent p-3 font-mono text-xs text-text-main outline-none focus:border-primary dark:border-white/10"
                  spellCheck={false}
                />
                {jsonError ? <p className="mt-2 text-sm text-red-500">{jsonError}</p> : null}
              </div>
            ) : (
              <>
                <Input label="Name" value={editModal.server?.name || ""} onChange={(event) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, name: event.target.value } }))} />
                <Input label="Command" value={editModal.server?.command || ""} onChange={(event) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, command: event.target.value } }))} placeholder="npx" />
                <Input label="Args" value={(editModal.server?.args || []).join("\n")} onChange={(event) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, args: toStringArray(event.target.value) } }))} placeholder="-y&#10;@modelcontextprotocol/server-memory@latest" />
                <Input label="Endpoint" value={editModal.server?.endpoint || ""} onChange={(event) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, endpoint: event.target.value } }))} placeholder="https://example.com/mcp" />
                <div>
                  <label className="text-sm font-medium text-text-main">Environment JSON</label>
                  <textarea
                    value={stringifyJsonObject(editModal.server?.env)}
                    onChange={(event) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, env: parseJsonObject(event.target.value) } }))}
                    className="mt-2 min-h-[120px] w-full rounded-lg border border-black/10 bg-transparent p-3 font-mono text-xs text-text-main outline-none focus:border-primary dark:border-white/10"
                    placeholder={`{\n  "API_KEY": ""\n}`}
                    spellCheck={false}
                  />
                </div>
                <label className="flex items-center justify-between rounded-lg border border-black/10 p-3 dark:border-white/10">
                  <span className="text-sm text-text-main">Enabled</span>
                  <Toggle checked={editModal.server?.enabled === true} onChange={() => setEditModal((prev) => ({ ...prev, server: { ...prev.server, enabled: !prev.server?.enabled } }))} size="md" />
                </label>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeEditModal} className="rounded-lg border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-main dark:border-white/10">
                Cancel
              </button>
              <button type="button" onClick={saveEditModal} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
