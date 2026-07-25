// Per-provider config for the GenericWebExecutor.
//
// `implemented: true`  -> a verified OpenAI-shaped request/response mapping.
// `implemented: false` -> registered in the catalog for parity, but the web
//   protocol is not yet reverse-engineered; the executor returns a clear 501
//   so the provider is discoverable without shipping fragile guessed code.
//
// DuckDuckGo has its own dedicated executor (anonymous handshake flow) and is
// not configured here.

export const WEB_CHAT_CONFIGS = {
  // ── Implemented: OpenAI-shaped web backends behind a session token ──
  "deepseek-web": {
    implemented: false, // chat.deepseek.com uses a proprietary PoW-protected API
    chatUrl: "https://chat.deepseek.com/api/v0/chat/completion",
    origin: "https://chat.deepseek.com",
    referer: "https://chat.deepseek.com/",
    authMode: "bearer",
    authHint: "Paste your userToken from chat.deepseek.com (DevTools → Application → Local Storage → userToken).",
  },
  "venice-web": {
    implemented: false,
    chatUrl: "https://venice.ai/api/inference/chat",
    origin: "https://venice.ai",
    referer: "https://venice.ai/",
    authMode: "cookie",
    cookieName: "session",
    authHint: "Paste your session cookie from venice.ai.",
  },

  // ── Registered for parity; web protocol not yet reverse-engineered ──
  "chatgpt-web": {
    implemented: false, authMode: "cookie", cookieName: "__Secure-next-auth.session-token",
    authHint: "Paste your __Secure-next-auth.session-token from chatgpt.com.",
  },
  "gemini-web": {
    implemented: false, authMode: "cookie", cookieName: "__Secure-1PSID",
    authHint: "Paste your __Secure-1PSID cookie from gemini.google.com.",
  },
  "claude-web": {
    implemented: false, authMode: "cookie", cookieName: "sessionKey",
    authHint: "Paste your session cookie from claude.ai.",
  },
  "copilot-web": {
    implemented: false, authMode: "bearer",
    authHint: "Paste your access_token from copilot.microsoft.com.",
  },
  "blackbox-web": {
    implemented: false, authMode: "cookie", cookieName: "__Secure-authjs.session-token",
    authHint: "Paste your session token from app.blackbox.ai.",
  },
  "muse-spark-web": {
    implemented: false, authMode: "cookie", cookieName: "abra_sess",
    authHint: "Paste your abra_sess cookie from meta.ai.",
  },
  "t3-web": {
    implemented: false, authMode: "cookie", cookieName: "convex-session-id",
    authHint: "Paste your convex-session-id from t3.chat.",
  },
  "inner-ai": {
    implemented: false, authMode: "cookie", cookieName: "token",
    authHint: "Paste your token cookie + email from app.innerai.com.",
  },
  "adapta-web": {
    implemented: false, authMode: "cookie", cookieName: "__client",
    authHint: "Paste your __client cookie from agent.adapta.one.",
  },
  huggingchat: {
    implemented: false, authMode: "cookie", cookieName: "hf-chat",
    chatUrl: "https://huggingface.co/chat/conversation",
    origin: "https://huggingface.co", referer: "https://huggingface.co/chat/",
    authHint: "Optional hf-chat cookie from huggingface.co/chat.",
  },
  phind: {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Optional session cookie from phind.com.",
  },
  "poe-web": {
    implemented: false, authMode: "cookie", cookieName: "p-b",
    authHint: "Paste your p-b cookie from poe.com.",
  },
  "v0-vercel-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste your session cookie from v0.dev.",
  },
  "kimi-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste your session cookie from kimi.moonshot.cn.",
  },
  "doubao-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste your session cookie from doubao.com.",
  },
  "notion-web": {
    implemented: false,
    authMode: "cookie",
    cookieName: "token_v2",
    chatUrl: "https://app.notion.com/api/v3/runInferenceTranscript",
    origin: "https://www.notion.so",
    referer: "https://www.notion.so/",
    authHint: "Paste your token_v2 cookie from notion.so (Notion AI). Unofficial; ToS risk.",
  },
  "qwen-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste session cookie from tongyi.aliyun.com / qwen chat.",
  },
  "yuanbao-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste session cookie from yuanbao.tencent.com.",
  },
  "zai-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste session cookie from chat.z.ai.",
  },
  "felo-web": {
    implemented: false, authMode: "cookie", cookieName: "session",
    authHint: "Paste session cookie from felo.ai.",
  },
};

export const WEB_CHAT_PROVIDER_IDS = Object.keys(WEB_CHAT_CONFIGS);
