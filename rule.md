# XLab_Router Feature Parity Rules

Ngay cap nhat: 17/05/2026

## Muc tieu bat buoc

- XLab_Router phai dam bao tich hop 100% tinh nang tuong thich cot loi tu `decolua/9router`, `diegosouzapw/OmniRoute` va `router-for-me/CLIProxyAPI`.
- Moi thay doi moi khong duoc lam mat tuong thich API, routing, proxy, provider, quota, token refresh, compression, dashboard, test hoac CLI compatibility da co.
- Khi them hoac sua logic router, phai doi chieu lai 3 nhom tinh nang nguon ben duoi va test local truoc khi hoan tat.

## Checklist 9router

- OpenAI-compatible APIs: chat, responses, messages, embeddings, images, audio, moderation, rerank, search/fetch, models.
- Format translation: OpenAI, Claude, Gemini, Cursor, Kiro, Vertex, Antigravity, Ollama, Responses API.
- Smart fallback/routing: provider fallback, account fallback, combo fallback, sticky round-robin.
- Provider management: provider nodes, API key/OAuth/web-cookie connections, custom models, disabled/hidden models.
- Usage/quota analytics: request history, token/cost tracking, quota status, provider limit view.
- RTK/Caveman compression: tool-result compression, caveman prompt injection, stacked compression mode.
- Tunnel/proxy: Cloudflare, ngrok, Tailscale, proxy pools, MITM proxy, provider/key proxy support.
- Cloud/config sync, pricing management, OAuth import, CLI tool integration, dashboard management.

## Checklist OmniRoute

- Universal routing gateway with subscription/API-key/cheap/free fallback tiers.
- Advanced combo routing: fallback, round-robin, sticky round-robin, account failover.
- Context Relay/Handoff: summarize current conversation before account/quota switch and inject handoff into the next account request.
- MCP/A2A compatibility surface: MCP registry/tooling and agent communication compatibility must not regress.
- RTK + Caveman compression and compression-combo pipeline.
- Model visibility controls, email masking, OAuth repair/diagnostics, uninstall scripts.
- Idempotency/deduplication, PII-safe logging, graceful shutdown, structured request observability.
- Desktop/PWA/mobile-access compatibility where relevant to XLab_Router web/CLI runtime.
- i18n/runtime translation support and full local test/build validation.

## Checklist CLIProxyAPI

- OpenAI/Gemini/Claude/Codex-compatible endpoint behavior for CLI and IDE clients.
- Multi-account load balancing with `fill-first` and `round-robin`.
- OAuth/API-key credential lifecycle, refresh, status, masking and safe management.
- Runtime settings/config reload through local API without requiring process restart.
- Management API compatibility surface for config, auth/provider lists, logs, API keys and debug status.
- Provider-specific routing and model mapping/fallback.
- Streaming and non-streaming compatibility; WebSocket-compatible clients must fail safely if unsupported.
- Rotating logs, request logging, local tests and safe remote-management defaults.

## Quy tac phat trien

- Truoc khi danh dau hoan tat, phai ra lai checklist nay va chi ghi nhan cac phan da thuc su chay duoc.
- Neu phat hien gap so voi 3 repo nguon, uu tien tich hop vao logic hien co, han che tao file moi khi co the.
- Khong duoc thay doi breaking API neu chua co route tuong thich hoac fallback tuong duong.
- Test toi thieu sau thay doi: unit test lien quan, build/lint kha dung va kiem tra route chinh bi anh huong.
