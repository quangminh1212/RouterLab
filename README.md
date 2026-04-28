<div align="center">
  
  # XLab Router - Free AI Router
  
  **Never stop coding. Auto-route to FREE & cheap AI models with smart fallback.**
  
  **Connect All AI Code Tools (Claude Code, Cursor, Antigravity, Copilot, Codex, Gemini, OpenCode, Cline, OpenClaw...) to 40+ AI Providers & 100+ Models.**
  

  [🚀 Quick Start](#quick-start) • [💡 Features](#key-features) • [📖 Setup](#setup-guide) • [🌐 Website](https://xlabrouter.com)

  [🇻🇳 Tiếng Việt](./i18n/README.vi.md) • [🇨🇳 中文](./i18n/README.zh-CN.md) • [🇯🇵 日本語](./i18n/README.ja-JP.md)
</div>

---

## 🤔 Why XLab Router?

**Stop wasting money and hitting limits:**

- ❌ Subscription quota expires unused every month
- ❌ Rate limits stop you mid-coding
- ❌ Expensive APIs ($20-50/month per provider)
- ❌ Manual switching between providers

**XLab Router solves this:**

- ✅ **Maximize subscriptions** - Track quota, use every bit before reset
- ✅ **Auto fallback** - Subscription → Cheap → Free, zero downtime
- ✅ **Multi-account** - Round-robin between accounts per provider
- ✅ **Universal** - Works with Claude Code, Codex, Gemini CLI, Cursor, Cline, any CLI tool

---

## 🔄 How It Works

```
┌─────────────┐
│  Your CLI   │  (Claude Code, Codex, Gemini CLI, OpenClaw, Cursor, Cline...)
│   Tool      │
└──────┬──────┘
       │ http://localhost:1212/v1
       ↓
┌─────────────────────────────────────────┐
│           XLab Router (Smart Router)        │
│  • Format translation (OpenAI ↔ Claude) │
│  • Quota tracking                       │
│  • Auto token refresh                   │
└──────┬──────────────────────────────────┘
       │
       ├─→ [Tier 1: SUBSCRIPTION] Claude Code, Codex, Gemini CLI
       │   ↓ quota exhausted
       ├─→ [Tier 2: CHEAP] GLM ($0.6/1M), MiniMax ($0.2/1M)
       │   ↓ budget limit
       └─→ [Tier 3: FREE] iFlow, Qwen, Kiro (unlimited)

Result: Never stop coding, minimal cost
```

---

## 🚀 Quick Start

**1. Install and run:**

Global install (recommended if you want the `xlabrouter` command everywhere):

```bash
npm install -g xlabrouter
xlabrouter
# optional alias:
# xrouter
```

Run without global install:

```bash
npx xlabrouter
# optional alias:
# npx xrouter
```

Local project install:

```bash
npm install xlabrouter
npx xlabrouter
# or: npx xrouter
# or: ./node_modules/.bin/xlabrouter
```

XLab Router starts the Web UI in the current terminal by default.
Open the dashboard at `http://localhost:1212`.
Use `xlabrouter --tray` if you want the background/system tray mode.
You can also use the shorter alias `xrouter` if you prefer.

**2. Connect a FREE provider (no signup needed):**

Dashboard → Providers → Connect **Claude Code** or **Antigravity** → OAuth login → Done!

**3. Use in your CLI tool:**

```
Claude Code/Codex/Gemini CLI/OpenClaw/Cursor/Cline Settings:
  Endpoint: http://localhost:1212/v1
  API Key: [copy from dashboard]
  Model: if/kimi-k2-thinking
```

**That's it!** Start coding with FREE AI models.

---

## 📖 Full Documentation

Visit [xlabrouter.com](https://xlabrouter.com) for complete setup guides, provider configuration, and advanced features.

---

## 🛠️ Support

- **Website**: [xlabrouter.com](https://xlabrouter.com)
- **GitHub**: [github.com/quangminh1212/XLab_Router](https://github.com/quangminh1212/XLab_Router)
- **Issues**: [github.com/quangminh1212/XLab_Router/issues](https://github.com/quangminh1212/XLab_Router/issues)

---

## 📄 License

ISC License - see [LICENSE](LICENSE) for details.
