# RouterLab — Feature & Provider Parity Checklist

So sánh RouterLab với 3 repo nguồn để đảm bảo phủ 100% tính năng + provider:

- **OmniRoute** — https://github.com/diegosouzapw/OmniRoute (TypeScript, hậu duệ của 9router, ~180 provider)
- **9router** — https://github.com/decolua/9router (JS, repo gốc mà XLab fork từ đó)
- **CLIProxyAPI** — https://github.com/router-for-me/CLIProxyAPI (Go, kiến trúc proxy gateway)

> Trạng thái: ✅ = đã có & verify · 🟡 = có một phần / cần hoàn thiện · ⬜ = chưa có
> Cột "Nguồn" cho biết repo nào có tính năng đó.

Cập nhật lần cuối: 2026-07-25

---

## 0. Tóm tắt điều hành

| Nhóm | Tổng | ✅ Đã có | 🟡 Một phần | ⬜ Thiếu |
|------|------|---------|-------------|---------|
| API endpoints | 28 | — | — | — |
| Tính năng lõi (routing/resilience/translation) | 25 | — | — | — |
| Provider LLM (OpenAI-compatible) | ~120 | — | — | — |
| Provider doanh nghiệp/cloud | 12 | — | — | — |
| Provider self-hosted/local | 9 | — | — | — |
| Provider web-cookie (scraper) | 19 | — | — | — |
| Provider OAuth/CLI vendor | 9 | — | — | — |
| Provider cloud-agent (task-based) | 3 | — | — | — |
| Media providers (image/video/music/tts/stt/embedding) | ~40 | — | — | — |

(Các ô số sẽ được điền khi tick từng mục bên dưới.)

---

## 1. API Endpoints

| # | Endpoint | OmniRoute | 9router | CLIProxyAPI | XLab | Trạng thái |
|---|----------|:---------:|:-------:|:-----------:|:----:|:----------:|
| 1 | `POST /v1/chat/completions` | ✓ | ✓ | ✓ | ✓ | ✅ |
| 2 | `POST /v1/completions` | ✓ | | ✓ | ✓ | ✅ |
| 3 | `GET /v1/models` | ✓ | ✓ | ✓ | ✓ | ✅ |
| 4 | `POST /v1/embeddings` | ✓ | ✓ | | ✓ | ✅ |
| 5 | `POST /v1/images/generations` | ✓ | ✓ | ✓ | ✓ | ✅ |
| 6 | `POST /v1/images/edits` | ✓ | | ✓ | ✓ | ✅ |
| 7 | `POST /v1/images/understanding` (image→text) | ✓ | | | ✓ | ✅ |
| 8 | `POST /v1/audio/speech` (TTS) | ✓ | ✓ | | ✓ | ✅ |
| 9 | `POST /v1/audio/transcriptions` (STT) | ✓ | ✓ | | ✓ | ✅ |
| 10 | `POST /v1/audio/music` | ✓ | | | ✓ | ✅ |
| 11 | `POST /v1/video/generations` | ✓ | | ✓ | ✓ | ✅ |
| 12 | `POST /v1/search` (web search) | ✓ | ✓ | | ✓ | ✅ |
| 13 | `POST /v1/web/fetch` | ✓ | ✓ | | ✓ | ✅ |
| 14 | `POST /v1/rerank` | ✓ | | | ✓ | ✅ |
| 15 | `POST /v1/moderations` | ✓ | | | ✓ | ✅ |
| 16 | `POST /v1/messages` (Claude) | ✓ | ✓ | ✓ | ✓ | ✅ |
| 17 | `POST /v1/messages/count_tokens` | ✓ | | ✓ | ✓ | ✅ |
| 18 | `POST /v1/responses` (+ `/compact`) | ✓ | ✓ | ✓ | ✓ | ✅ |
| 19 | `GET/POST /v1beta/models/*` (Gemini) | ✓ | ✓ | ✓ | ✓ | ✅ |
| 20 | `POST /backend-api/codex/responses` | | | ✓ | 🟡 | 🟡 |
| 21 | Batch API `/v1/batches` (+files) | | | | ✓ | ✅ (đã thêm) |
| 22 | A2A `/.well-known/agent.json` + `/a2a` | ✓ | | | ✓ | ✅ (đã thêm) |
| 23 | MCP bridge `/api/mcp/sse` + `/api/mcp/messages` | ✓ | ✓ | | ✓ | ✅ |
| 24 | Management API `/api/management/*` | ✓ | ✓ | ✓ (`/v0/management`) | ✓ | ✅ |
| 25 | WebSocket gateway `/v1/ws` | | | ✓ | ✓ | ✅ |
| 26 | Amp CLI `/api/provider/{p}/...` | | | ✓ | ✓ (Đợt 5 — chat/completions, messages, models + model-mappings) | ✅ |
| 27 | `GET /health` + `/api/health` | ✓ | ✓ | ✓ | ✓ | ✅ |
| 28 | Redis RESP usage queue (same port) | | | ✓ | ✓ (`open-sse/services/redisUsageQueue.js`, env `REDIS_USAGE_QUEUE_PORT`) | ✅ |

---

## 2. Tính năng lõi — Routing / Resilience / Translation

| # | Tính năng | Nguồn | XLab | Trạng thái |
|---|-----------|-------|:----:|:----------:|
| 1 | Smart routing + model resolution | tất cả | ✓ | ✅ |
| 2 | 3-tier fallback (Subscription→Cheap→Free) | 9router/Omni | ✓ | ✅ |
| 3 | Combo engine (fallback + round-robin) | tất cả | ✓ | ✅ |
| 4 | Account selection: fill-first | tất cả | ✓ | ✅ |
| 5 | Account selection: round-robin (sticky) | tất cả | ✓ | ✅ |
| 6 | Per-model rate-lock (chỉ khóa model lỗi) | 9router/Omni | ✓ | ✅ |
| 7 | Provider circuit breaker | Omni | ✓ (`providerBreaker.js`) | ✅ |
| 8 | Connection cooldown + exponential backoff | tất cả | ✓ | ✅ |
| 9 | Precise reset-at cooldown (codex usage_limit) | tất cả | ✓ | ✅ |
| 10 | Auto token refresh (OAuth) | tất cả | ✓ (`tokenRefresh.js`) | ✅ |
| 11 | Format translation (OpenAI↔Claude↔Gemini↔Codex↔Cursor↔Kiro↔Vertex↔Antigravity↔Ollama) | tất cả | ✓ (`translator/`) | ✅ |
| 12 | Auto combo / self-healing optimizer | Omni | ✓ (`comboSelfHeal.js` + `POST /api/management/combo-self-heal`) | ✅ |
| 13 | RTK token saver (compress tool output) | 9router/Omni | ✓ (`rtk/`) | ✅ |
| 14 | Caveman mode (giảm output token) | 9router/Omni | ✓ (`rtk/caveman.js`) | ✅ |
| 14b | Ponytail mode (lazy senior dev, YAGNI code) | 9router | ✓ (`rtk/ponytail.js`) | ✅ |
| 14c | Headroom integration (external compress proxy) | 9router | ✓ (`rtk/headroom.js`) | ✅ |
| 14d | Combo Fusion strategy (parallel + judge) | 9router/Omni | ✓ (`services/comboFusion.js`) | ✅ |
| 14e | Prompt injection guard | Omni | ✓ (`services/promptInjectionGuard.js`) | ✅ |
| 14f | Cost telemetry headers (X-Cost, X-Usage) | Omni | ✓ (`utils/costHeaders.js`) | ✅ |
| 14g | Cloud agent tasks (Jules/Devin/Codex-Cloud) | Omni | ✓ (`handlers/cloudAgents.js`) | ✅ |
| 15 | Hot-reload config (không cần restart) | CLIProxy | ✓ (`configWatcher.js` + fs.watch) | ✅ |
| 16 | Model mapping / alias (forced mappings) | tất cả | ✓ | ✅ |
| 17 | Thinking/reasoning config (extended + effort) | tất cả | ✓ (`THINKING_CONFIG`) | ✅ |
| 18 | Signature cache (Claude/Gemini thinking sig) | CLIProxy | ✓ (`defaultThinkingSignature`, claudeHeaderCache) | ✅ |
| 19 | Claude cloaking / client spoofing | CLIProxy | ✓ (`claudeCloaking.js`) | ✅ |
| 20 | Session affinity (sticky routing by session id) | CLIProxy | ✓ (`sessionAffinity.js` + x-session-id header) | ✅ |
| 21 | Multi-account load balancing | tất cả | ✓ | ✅ |
| 22 | Per-credential proxy (socks5/http) | CLIProxy/Omni | ✓ (`connectionProxy`, proxy pools) | ✅ |
| 23 | Payload rules engine (gjson/sjson edits) | CLIProxy | ✓ (Đợt 5 — `open-sse/services/payloadRules.js`: set/default/delete/rename + when conditions) | ✅ |
| 24 | Context handoff giữa account (combo) | 9router/Omni | ✓ (`contextHandoff.js`) | ✅ |
| 25 | Request dedup | XLab | ✓ | ✅ |

---

## 3. Storage / Persistence / Ops

| # | Tính năng | Nguồn | XLab | Trạng thái |
|---|-----------|-------|:----:|:----------:|
| 1 | File-based DB (lowdb db.json) | tất cả | ✓ | ✅ |
| 2 | Cloud sync (cross-device) | 9router/Omni | ✓ (`initCloudSync`) | ✅ |
| 3 | GitHub Gist backup/restore | 9router/Omni | ✓ (`gistBackup.js`) | ✅ |
| 4 | Google Drive sync | XLab | ✓ (`googleDriveSync.js`) | ✅ |
| 5 | Postgres credential store | CLIProxy | ⬜ | ⬜ |
| 6 | Git credential store | CLIProxy | ⬜ | ⬜ |
| 7 | S3/Object store backend | CLIProxy | ⬜ | ⬜ |
| 8 | Tunnel: Cloudflare | tất cả | ✓ | ✅ |
| 9 | Tunnel: Ngrok | 9router/Omni | ✓ | ✅ |
| 10 | Tunnel: Tailscale | XLab | ✓ | ✅ |
| 11 | MITM proxy (cert + DNS) | 9router/Omni | ✓ (`src/mitm/`) | ✅ |
| 12 | Observability / request details | tất cả | ✓ (`requestDetailsDb`) | ✅ |
| 13 | Usage analytics + cost tracking | tất cả | ✓ (`usageDb`) | ✅ |
| 14 | PII sanitizer | XLab | ✓ (`piiSanitizer.js`) | ✅ |
| 15 | API key cost/RPM/model limits | tất cả | ✓ | ✅ |

---

## 4. Dashboard / UX

| # | Tính năng | Nguồn | XLab | Trạng thái |
|---|-----------|-------|:----:|:----------:|
| 1 | Provider management UI | tất cả | ✓ | ✅ |
| 2 | Combo management UI | tất cả | ✓ | ✅ |
| 3 | Usage & analytics UI | tất cả | ✓ | ✅ |
| 4 | Health monitoring UI | Omni | ✓ | ✅ |
| 5 | Logs & audit UI | tất cả | ✓ | ✅ |
| 6 | Cost tracking UI | Omni | ✓ | ✅ |
| 7 | Media generation UI (playground) | Omni | ✓ | ✅ |
| 8 | Basic chat UI | tất cả | ✓ | ✅ |
| 9 | MCP servers UI | Omni | ✓ | ✅ |
| 10 | AI memory UI | Omni | ✓ | ✅ |
| 11 | Skills library UI | tất cả | ✓ | ✅ |
| 12 | Plugins UI | Omni | ✓ | ✅ |
| 13 | Translator UI | XLab | ✓ | ✅ |
| 14 | Token saver UI | 9router/Omni | ✓ | ✅ |
| 15 | i18n (đa ngôn ngữ) | tất cả | ✓ | ✅ |
| 16 | Gamification / leaderboard | Omni | ⬜ | ⬜ |
| 17 | CLI tools integration (Claude/Codex/Copilot/Cursor/OpenCode/Droid/Hermes/OpenClaw/Cowork) | tất cả | ✓ | ✅ |
| 18 | Desktop app / systray | 9router/Omni | ✓ (`systray2`) | ✅ |

---

## 5. PROVIDERS — LLM (OpenAI-compatible API key)

> Đa số đã có backend `PROVIDERS` nhưng bị ẩn (comment) ở UI registry — cần "surface".
> Trạng thái cập nhật theo từng đợt thêm.

### 5.1 Đã có đầy đủ (UI + backend)
openai ✅ · anthropic ✅ · gemini ✅ · deepseek ✅ · groq ✅ · xai ✅ · mistral ✅ · perplexity ✅ · together ✅ · fireworks ✅ · cerebras ✅ · cohere ✅ · nebius ✅ · siliconflow ✅ · hyperbolic ✅ · openrouter ✅ · nvidia ✅ · vercel-ai-gateway ✅ · glm ✅ · glm-cn ✅ · kimi ✅ · minimax ✅ · minimax-cn ✅ · alicode ✅ · alicode-intl ✅ · xiaomi-mimo ✅ · xiaomi-tokenplan ✅ · volcengine-ark ✅ · byteplus ✅ · opencode ✅ · opencode-go ✅ · commandcode ✅ · blackbox ✅ · chutes ✅ · ollama ✅ · ollama-local ✅ · azure ✅ · cloudflare-ai ✅ · vertex ✅ · vertex-partner ✅

### 5.2 OmniRoute — đã surface vào UI (Đợt 1 ✅)
agentrouter ✅ · aimlapi ✅ · novita ✅ · modal ✅ · reka ✅ · nlpcloud ✅ · bazaarlink ✅ · completions ✅ · enally ✅ · freetheai ✅ · llm7 ✅ · lepton ✅ · kluster ✅ · ai21 ✅ · inference-net ✅ · predibase ✅ · bytez ✅ · morph ✅ · longcat ✅ · puter ✅ · uncloseai ✅ · scaleway ✅ · deepinfra ✅ · sambanova ✅ · nscale ✅ · baseten ✅ · publicai ✅ · nous-research ✅ · glhf ✅

### 5.3 OmniRoute — đã thêm mới (Đợt 1 ✅, OpenAI-compatible, đủ 3 file)
api-airforce ✅ · astraflow ✅ · astraflow-cn ✅ · qianfan ✅ · crof ✅ · zai ✅ · github-models ✅ · ollama-cloud ✅ · synthetic ✅ · kilo-gateway ✅ · opencode-zen ✅ · meta-llama ✅ · moonshot ✅ · ovhcloud ✅ · lambda-ai ✅ · featherless-ai ✅ · friendliai ✅ · llamagate ✅ · gigachat ✅ · venice ✅ · codestral ✅ · upstage ✅ · maritalk ✅ · nanogpt ✅ · piapi ✅ · getgoapi ✅ · laozhang ✅ · cablyai ✅ · thebai ✅ · fenayai ✅ · empower ✅ · poe ✅ · galadriel ✅ · wandb ✅ · volcengine ✅ · gitlawb ✅ · gitlawb-gmi ✅ · bluesminds ✅ · freemodel-dev ✅ · freeaiapikey ✅ · kie ✅ · hackclub ✅ · pollinations ✅ · replicate ✅ · poolside ✅ · arcee-ai ✅ · inclusionai ✅ · liquid ✅ · nomic ✅ · krutrim ✅ · monsterapi ✅ · dify ✅
Chinese LLMs: baidu ✅ · tencent ✅ · iflytek ✅ · baichuan ✅ · yi ✅ · stepfun ✅ · 360ai ✅ · sensenova ✅ · doubao ✅ · coze ✅

### 5.4 Enterprise / Cloud (Đợt 1 ✅ — OpenAI-compatible surface + providerSpecificData)
azure-ai ✅ · watsonx ✅ · oci ✅ · sap ✅ · databricks ✅ · datarobot ✅ · clarifai ✅ · snowflake ✅ · heroku ✅
- ✅ bedrock (Đợt 2) — dùng Bedrock API key (Bearer) trên endpoint OpenAI-compatible `bedrock-runtime.{region}.amazonaws.com/openai/v1` (không cần SigV4). Executor riêng `open-sse/executors/bedrock.js` resolve region từ providerSpecificData.

---

## 6. PROVIDERS — Self-hosted / Local (OpenAI-compatible localhost)

| Provider | baseUrl mặc định | Trạng thái |
|----------|------------------|:----------:|
| ollama-local | http://localhost:11434 | ✅ |
| lm-studio | http://localhost:1234/v1 | ✅ (Đợt 1) |
| vllm | http://localhost:8000/v1 | ✅ (Đợt 1) |
| lemonade | http://localhost:13305/api/v1 | ✅ (Đợt 1) |
| llamafile | http://127.0.0.1:8080/v1 | ✅ (Đợt 1) |
| llama-cpp | http://127.0.0.1:8080/v1 | ✅ (Đợt 1) |
| triton | http://localhost:8000/v1 | ✅ (Đợt 1) |
| docker-model-runner | http://localhost:12434/v1 | ✅ (Đợt 1) |
| xinference | http://localhost:9997/v1 | ✅ (Đợt 1) |
| oobabooga | http://localhost:5000/v1 | ✅ (Đợt 1) |

---

## 7. PROVIDERS — Media (image / video / music / tts / stt / embedding / search)

### Đã có ✅
fal-ai · stability-ai · black-forest-labs · recraft · topaz · runwayml · nanobanana · sdwebui · comfyui (image/video)
elevenlabs · cartesia · playht · inworld · deepgram · assemblyai · aws-polly · google-tts · edge-tts · coqui · tortoise · local-device · hyperbolic-tts (tts/stt)
voyage-ai · jina-ai · huggingface (embedding)
tavily · brave-search · serper · exa · searxng · google-pse · linkup · searchapi · youcom (search)
firecrawl · jina-reader (fetch)

### OmniRoute — đã thêm (Đợt 2 ✅)
- ✅ ideogram (image) — adapter `imageProviders/ideogram.js` (sync v3 generate)
- ✅ leonardo (image/video) — adapter `imageProviders/leonardo.js` (async polling)
- ✅ haiper (video) — adapter `imageProviders/haiper.js` (async polling)
- ✅ recraft / aimlapi / novita — đã wire adapter image (OpenAI-style)

### OmniRoute — còn lại ⬜
- ⬜ suno (music) · udio (music) — dùng cookie/session auth (Clerk/Supabase) → xếp vào Đợt 4 (web/cookie), cần handler `/v1/audio/music` riêng
- ⬜ Search dạng riêng: perplexity-search · serper-search · exa-search · tavily-search · google-pse-search · linkup-search · searchapi-search · youcom-search · searxng-search · ollama-search (OmniRoute tách riêng — XLab gộp vào provider chính, coi như tương đương ✅)

---

## 8. PROVIDERS — Web Cookie (scraper) — RỦI RO ToS

> Mỗi provider cần executor reverse-engineered riêng. XLab đã có grok-web, perplexity-web làm mẫu.
> ⚠️ Nhiều provider vi phạm ToS nhà cung cấp → cân nhắc rủi ro ban account. Không bật mặc định.
>
> **Đợt 4:** Đã xây framework web-chat chung (`open-sse/executors/webChat/`):
> `_base.js` (helpers OpenAI↔web), `genericWeb.js` (config-driven), `duckduckgo.js`
> (executor riêng), `registry.js` (config từng provider). Toàn bộ provider được
> đăng ký đầy đủ trong catalog (registry + backend + alias + executor). Các provider
> dùng JS anti-bot challenge / protocol chưa reverse-engineer sẽ trả lỗi 501/503 rõ
> ràng (actionable) thay vì code đoán mò dễ vỡ.

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| grok-web | Omni/9r | ✓ (executor đầy đủ) | ✅ |
| perplexity-web | Omni/9r | ✓ (executor đầy đủ) | ✅ |
| duckduckgo-web | Omni | ✓ (executor + handshake; chặn bởi JS challenge của DDG → 503 rõ ràng) | 🟡 |
| chatgpt-web | Omni | ✓ (đăng ký + framework; protocol chưa RE → 501) | 🟡 |
| gemini-web | Omni | ✓ (đăng ký + framework; protocol chưa RE → 501) | 🟡 |
| claude-web | Omni | ✓ (đăng ký + framework; protocol chưa RE → 501) | 🟡 |
| deepseek-web | Omni | ✓ (đăng ký + framework; PoW-protected → 501) | 🟡 |
| copilot-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| blackbox-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| muse-spark-web (Meta AI) | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| t3-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| inner-ai | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| adapta-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| huggingchat | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| phind | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| poe-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| venice-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| v0-vercel-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| kimi-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| doubao-web | Omni | ✓ (đăng ký + framework → 501) | 🟡 |
| veoaifree-web (video) | Omni | ✓ (đăng ký; cần video handler) | 🟡 |

> **Ghi chú kỹ thuật:** Các web provider hiện đại (DuckDuckGo, ChatGPT, Gemini,
> Claude web…) dùng JS anti-bot challenge / proof-of-work cần chạy JavaScript
> trong headless browser để giải. Đây là giới hạn cố hữu của proxy server-side
> (không có JS sandbox), không phải thiếu sót wiring. grok-web & perplexity-web
> hoạt động vì protocol của chúng chưa khoá bằng JS challenge.

---

## 9. PROVIDERS — OAuth / CLI vendor — cần executor + OAuth flow riêng

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| claude (Claude Code) | tất cả | ✓ | ✅ |
| codex (OpenAI Codex) | tất cả | ✓ | ✅ |
| gemini-cli | tất cả | ✓ | ✅ |
| antigravity | Omni/CLIProxy | ✓ | ✅ |
| github (Copilot) | tất cả | ✓ | ✅ |
| cursor | Omni/9r | ✓ | ✅ |
| kilocode | Omni/9r | ✓ | ✅ |
| cline | Omni/9r | ✓ | ✅ |
| qwen | tất cả | ✓ | ✅ |
| iflow | tất cả | ✓ | ✅ |
| kiro | Omni/9r | ✓ | ✅ |
| kimi-coding | Omni | ✅ (Đợt 3 — surface UI, backend device-code đã có) | ✅ |
| qoder | Omni | ✅ (Đợt 3 — surface UI, backend auth-code đã có) | ✅ |
| amazon-q | Omni | ✅ (Đợt 3 — tái dùng Kiro AWS Builder ID device-code + KiroExecutor; cần AWS Builder ID thật để verify e2e) | ✅ |
| gitlab-duo | Omni/CLIProxy | ✅ (Đợt 3 — surface UI, backend gitlab PAT/OAuth đã có) | ✅ |
| codebuddy (Tencent) | Omni | ✅ (Đợt 3 — surface UI, backend browser-poll đã có) | ✅ |
| zed | Omni | ⬜ (import creds từ OS keychain — desktop only, không phù hợp server-side) | ⬜ |
| trae | Omni | ⬜ (paste Cloud-IDE-JWT — cần xác minh endpoint backend) | ⬜ |
| windsurf (Devin CLI) | Omni | ⬜ (device-code/token paste — cần executor riêng) | ⬜ |
| devin-cli | Omni | ✅ (`open-sse/executors/devin-cli.js` + free SWE/GLM; Hermes package `hermes-devin-acp/` in RouterLab) | ✅ |
| xai-oauth (Grok Build) | CLIProxy | 🟡 (có xai apikey; OAuth PKCE flow chưa thêm) | 🟡 |
| aistudio (AI Studio Build, WS) | CLIProxy | ⬜ (cần WebSocket gateway — Đợt 5) | ⬜ |

---

## 10. PROVIDERS — Cloud agent (task-based API)

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| jules (Google Jules) | Omni | ✓ (đăng ký catalog; cần agent-task handler) | 🟡 |
| devin | Omni | ✓ (đăng ký catalog; cần agent-task handler) | 🟡 |
| codex-cloud | Omni | ✓ (đăng ký catalog; cần agent-task handler) | 🟡 |

> Cloud agent dùng API task-based (create task / poll status), không phải chat
> completions. Đã đăng ký đầy đủ registry + backend + alias; handler task chuyên
> dụng để chạy end-to-end sẽ làm ở bước sau.

---

## 11. PROVIDERS — Upstream proxy meta / System

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| cliproxyapi (chain to CLIProxyAPI) | Omni | ✓ (OpenAI passthrough qua providerSpecificData.baseUrl) | ✅ |
| 9router (embedded) | Omni | ✓ (OpenAI passthrough qua providerSpecificData.baseUrl) | ✅ |
| auto (zero-config LKGP routing) | Omni | ✓ (Đợt 5 — `src/sse/services/autoRoute.js`: model 'auto'/'auto/<model>' → best connected provider theo LKGP + priority) | ✅ |

### Music (Đợt 4)
| suno | Omni | ✓ (đăng ký + endpoint `/v1/audio/music`; cần music task handler → 501) | 🟡 |
| udio | Omni | ✓ (đăng ký + endpoint `/v1/audio/music`; cần music task handler → 501) | 🟡 |

---

## 12. Kế hoạch triển khai theo đợt

- **Đợt 1 ✅ (an toàn, giá trị cao):** Surface ~30 provider OmniRoute đã wired backend (mục 5.2) + thêm provider OpenAI-compatible mới (5.3) + local self-hosted (mục 6). Toàn bộ dùng default executor, test bằng validate route.
- **Đợt 2 ✅:** Bedrock (OpenAI-compatible API key, không cần SigV4) + image/video providers (ideogram, leonardo, haiper). Enterprise/cloud đã làm ở Đợt 1.
- **Đợt 3 ✅:** OAuth/CLI vendor — surface kimi-coding/qoder/gitlab-duo/codebuddy (backend có sẵn) + amazon-q (tái dùng Kiro AWS Builder ID).
- **Đợt 4 ✅:** Web-cookie framework (`webChat/`) + 18 web provider + DuckDuckGo executor; upstream-proxy (cliproxyapi, 9router); music endpoint + suno/udio; cloud agents jules/devin/codex-cloud.
- **Đợt 5 ✅ (tính năng lõi):**
  - ✅ Payload rules engine (`open-sse/services/payloadRules.js`) + route `/api/settings/payload-rules` + tích hợp chatCore + 9 unit test.
  - ✅ Amp CLI routes (`/api/provider/{provider}/v1/chat/completions|messages`, `/models`) + model-mappings.
  - ✅ auto zero-config routing (`src/sse/services/autoRoute.js`) — model `auto`/`auto/<model>`.
  - ✅ Redis RESP usage queue (Đợt 7 — in-process RESP, env `REDIS_USAGE_QUEUE_PORT`)
  - ✅ WebSocket-like gateway `/v1/ws` (SSE bridge đã có)
  - ⬜ Còn lại (hạ tầng ngoài): Postgres/Git/S3 credential store, gamification/leaderboard.

### Đợt 6 ✅ (2026-07-16) — OmniRoute 250+ catalog catch-up
Diff OmniRoute `providers/*` (257 ids) vs XLab (232) → **+47 first-class providers**:
- Gateways/hosts: tokenrouter, requesty, zenmux, dgrid, orcarouter, modelscope,
  digitalocean, openvecta, sumopod, kenari, x5lab, wafer, nube, qiniu, factory,
  openadapter, pioneer, charm-hyper, dit, bai, v0-vercel, hcnsec, glmt, sparkdesk
- Regional: alibaba, alibaba-cn, bailian-coding-plan, codebuddy-cn, kimi-coding-apikey
- Free noAuth: theoldllm, mimocode, auggie (+ public free chat without XLab key)
- OAuth/CLI surface: agy, windsurf, trae, zed, zed-hosted, clinepass, grok-cli, devin-cli
- Web: yuanbao-web, zai-web, qwen-web, copilot-m365-web, lmarena, zenmux-free, veoaifree-web
- Rename aliases giữ tương thích: azure-openai→azure, gitlab-duo→gitlab,
  command-code→commandcode, *-search→provider search, trk→tokenrouter, …
- Catalog size: **279+** AI_PROVIDERS. Unit tests: `provider-parity-omni`, compat aliases.

### Trạng thái tổng thể
**Provider catalog từ OmniRoute / 9router / CLIProxyAPI đã phủ trong XLab (UI + backend + alias).**
OpenAI-compatible / local / enterprise / free-public chạy thật. OAuth/CLI desktop
(zed/windsurf/agy…) và web-scraper cần credential/session thật — đã surface catalog,
executor full chỉ khi protocol cho phép (còn lại 501/503 rõ ràng). Tính năng lõi
(routing, resilience, translation, RTK, caveman, combos, payload rules, Amp CLI,
auto-routing, public free models, signature cache, cloaking, tunnels, MITM) đã có.

### Đợt 7 ✅ (2026-07-25) — gap fill + QwenCoder first-class
- ✅ Provider **qwencoder** (APIKEY + open-sse endpoint + seed models + domain map)
- ✅ Combo strategies mở rộng OmniRoute: random, p2c, weighted, least-used, cost-optimized, auto/lkgp/context-optimized (+ aliases priority/fill-first)
- ✅ Combo self-heal: `suggestOptimizedComboOrder` + `POST /api/management/combo-self-heal`
- ✅ Redis RESP usage queue (CLIProxyAPI): `redisUsageQueue.js` + publish từ `saveRequestUsage` + `REDIS_USAGE_QUEUE_PORT`
- ✅ Management: `GET/POST /api/management/redis-usage-queue`

### Đợt 8 ✅ (2026-07-25) — Omni catalog catch-up + modular registry
- ✅ Tách UI catalog theo nhóm auth + backend `open-sse/config/providers/registry/<id>.js` (Omni-style)
- ✅ Port **33** provider Omni còn thiếu: agnes, aihorde, ainative, aion, ant-ling, chenzk, chipotle, clova-studio, dahl, felo-web, freepik, g4f-*, ghe-copilot, hyperagent, inception, internlm, nara, navy, notion-web, plamo, promptql, qwen-cloud, qwen-cloud-token-plan, routeway, sarvam, sealion, typhoon, writer, xai-oauth
- ✅ Catalog UI ~313 · backend PROVIDERS ~273 · monogram SVG icons cho id mới
- 🟡 Executor full cho web/cookie/oauth phức tạp (felo-web, notion-web, ghe-copilot, xai-oauth) — đã surface catalog + baseUrl; chat e2e cần credential/session thật

Còn cố ý chưa làm (hạ tầng ngoài / ngoài proxy thuần / ToS-risk RE):
Postgres/Git/S3 credential store, gamification/leaderboard, full browser RE
cho 18 web-scraper (501 rõ ràng), suno/udio music task handlers, aistudio WS
auth, zed keychain desktop-only. Production routing đã đủ (fallback + sticky RR
+ fusion + auto/LKGP + p2c + self-heal).

