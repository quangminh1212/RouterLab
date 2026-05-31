# XLab Router — Feature & Provider Parity Checklist

So sánh XLab Router với 3 repo nguồn để đảm bảo phủ 100% tính năng + provider:

- **OmniRoute** — https://github.com/diegosouzapw/OmniRoute (TypeScript, hậu duệ của 9router, ~180 provider)
- **9router** — https://github.com/decolua/9router (JS, repo gốc mà XLab fork từ đó)
- **CLIProxyAPI** — https://github.com/router-for-me/CLIProxyAPI (Go, kiến trúc proxy gateway)

> Trạng thái: ✅ = đã có & verify · 🟡 = có một phần / cần hoàn thiện · ⬜ = chưa có
> Cột "Nguồn" cho biết repo nào có tính năng đó.

Cập nhật lần cuối: 2026-05-31

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
| 6 | `POST /v1/images/edits` | ✓ | | ✓ | 🟡 | 🟡 |
| 7 | `POST /v1/images/understanding` (image→text) | ✓ | | | ✓ | ✅ |
| 8 | `POST /v1/audio/speech` (TTS) | ✓ | ✓ | | ✓ | ✅ |
| 9 | `POST /v1/audio/transcriptions` (STT) | ✓ | ✓ | | ✓ | ✅ |
| 10 | `POST /v1/audio/music` | ✓ | | | 🟡 | 🟡 |
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
| 23 | MCP bridge `/api/mcp/[plugin]/sse` | ✓ | ✓ | | 🟡 | 🟡 |
| 24 | Management API `/api/management/*` | ✓ | ✓ | ✓ (`/v0/management`) | ✓ | ✅ |
| 25 | WebSocket gateway `/v1/ws` | | | ✓ | ⬜ | ⬜ |
| 26 | Amp CLI `/api/provider/{p}/...` | | | ✓ | ⬜ | ⬜ |
| 27 | `GET /health` + `/api/health` | ✓ | ✓ | ✓ | ✓ | ✅ |
| 28 | Redis RESP usage queue (same port) | | | ✓ | ⬜ | ⬜ |

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
| 12 | Auto combo / self-healing optimizer | Omni | 🟡 | 🟡 |
| 13 | RTK token saver (compress tool output) | 9router/Omni | ✓ (`rtk/`) | ✅ |
| 14 | Caveman mode (giảm output token) | 9router/Omni | ✓ (`rtk/caveman.js`) | ✅ |
| 15 | Hot-reload config (không cần restart) | CLIProxy | 🟡 (lowdb cache refresh) | 🟡 |
| 16 | Model mapping / alias (forced mappings) | tất cả | ✓ | ✅ |
| 17 | Thinking/reasoning config (extended + effort) | tất cả | ✓ (`THINKING_CONFIG`) | ✅ |
| 18 | Signature cache (Claude/Gemini thinking sig) | CLIProxy | ✓ (`defaultThinkingSignature`, claudeHeaderCache) | ✅ |
| 19 | Claude cloaking / client spoofing | CLIProxy | ✓ (`claudeCloaking.js`) | ✅ |
| 20 | Session affinity (sticky routing by session id) | CLIProxy | 🟡 | 🟡 |
| 21 | Multi-account load balancing | tất cả | ✓ | ✅ |
| 22 | Per-credential proxy (socks5/http) | CLIProxy/Omni | ✓ (`connectionProxy`, proxy pools) | ✅ |
| 23 | Payload rules engine (gjson/sjson edits) | CLIProxy | ⬜ | ⬜ |
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
openai ✅ · anthropic ✅ · gemini ✅ · deepseek ✅ · groq ✅ · xai ✅ · mistral ✅ · perplexity ✅ · together ✅ · fireworks ✅ · cerebras ✅ · cohere ✅ · nebius ✅ · siliconflow ✅ · hyperbolic ✅ · openrouter ✅ · nvidia ✅ · vercel-ai-gateway ✅ · glm ✅ · glm-cn ✅ · kimi ✅ · minimax ✅ · minimax-cn ✅ · alicode ✅ · alicode-intl ✅ · xiaomi-mimo ✅ · xiaomi-tokenplan ✅ · volcengine-ark ✅ · byteplus ✅ · opencode ✅ · opencode-go ✅ · commandcode ✅ · blackbox ✅ · chutes ✅ · cungcapai(TamMao) ✅ · ollama ✅ · ollama-local ✅ · azure ✅ · cloudflare-ai ✅ · vertex ✅ · vertex-partner ✅

### 5.2 OmniRoute — đã surface vào UI (Đợt 1 ✅)
agentrouter ✅ · aimlapi ✅ · novita ✅ · modal ✅ · reka ✅ · nlpcloud ✅ · bazaarlink ✅ · completions ✅ · enally ✅ · freetheai ✅ · llm7 ✅ · lepton ✅ · kluster ✅ · ai21 ✅ · inference-net ✅ · predibase ✅ · bytez ✅ · morph ✅ · longcat ✅ · puter ✅ · uncloseai ✅ · scaleway ✅ · deepinfra ✅ · sambanova ✅ · nscale ✅ · baseten ✅ · publicai ✅ · nous-research ✅ · glhf ✅

### 5.3 OmniRoute — đã thêm mới (Đợt 1 ✅, OpenAI-compatible, đủ 3 file)
api-airforce ✅ · astraflow ✅ · astraflow-cn ✅ · qianfan ✅ · crof ✅ · zai ✅ · github-models ✅ · ollama-cloud ✅ · synthetic ✅ · kilo-gateway ✅ · opencode-zen ✅ · meta-llama ✅ · moonshot ✅ · ovhcloud ✅ · lambda-ai ✅ · featherless-ai ✅ · friendliai ✅ · llamagate ✅ · gigachat ✅ · venice ✅ · codestral ✅ · upstage ✅ · maritalk ✅ · nanogpt ✅ · piapi ✅ · getgoapi ✅ · laozhang ✅ · cablyai ✅ · thebai ✅ · fenayai ✅ · empower ✅ · poe ✅ · galadriel ✅ · wandb ✅ · volcengine ✅ · gitlawb ✅ · gitlawb-gmi ✅ · bluesminds ✅ · freemodel-dev ✅ · freeaiapikey ✅ · kie ✅ · hackclub ✅ · pollinations ✅ · replicate ✅ · poolside ✅ · arcee-ai ✅ · inclusionai ✅ · liquid ✅ · nomic ✅ · krutrim ✅ · monsterapi ✅ · dify ✅
Chinese LLMs: baidu ✅ · tencent ✅ · iflytek ✅ · baichuan ✅ · yi ✅ · stepfun ✅ · 360ai ✅ · sensenova ✅ · doubao ✅ · coze ✅

### 5.4 Enterprise / Cloud (Đợt 1 ✅ — OpenAI-compatible surface + providerSpecificData)
azure-ai ✅ · watsonx ✅ · oci ✅ · sap ✅ · databricks ✅ · datarobot ✅ · clarifai ✅ · snowflake ✅ · heroku ✅
- 🟡 bedrock — cần SigV4 ký request (chưa thêm; sẽ làm Đợt 2 với executor riêng)

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

### OmniRoute — cần thêm ⬜
- ⬜ ideogram (image) · leonardo (image/video) · haiper (video) · suno (music) · udio (music)
- ⬜ Search dạng riêng: perplexity-search · serper-search · exa-search · tavily-search · google-pse-search · linkup-search · searchapi-search · youcom-search · searxng-search · ollama-search (OmniRoute tách riêng — XLab gộp vào provider chính, coi như tương đương ✅)

---

## 8. PROVIDERS — Web Cookie (scraper) — RỦI RO ToS

> Mỗi provider cần executor reverse-engineered riêng. XLab đã có grok-web, perplexity-web làm mẫu.
> ⚠️ Nhiều provider vi phạm ToS nhà cung cấp → cân nhắc rủi ro ban account. Không bật mặc định.

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| grok-web | Omni/9r | ✓ | ✅ |
| perplexity-web | Omni/9r | ✓ | ✅ |
| chatgpt-web | Omni | ⬜ | ⬜ |
| gemini-web | Omni | ⬜ | ⬜ |
| claude-web | Omni | ⬜ | ⬜ |
| deepseek-web | Omni | ⬜ | ⬜ |
| copilot-web | Omni | ⬜ | ⬜ |
| blackbox-web | Omni | ⬜ | ⬜ |
| muse-spark-web (Meta AI) | Omni | ⬜ | ⬜ |
| t3-web | Omni | ⬜ | ⬜ |
| inner-ai | Omni | ⬜ | ⬜ |
| adapta-web | Omni | ⬜ | ⬜ |
| duckduckgo-web | Omni | ⬜ | ⬜ |
| huggingchat-web | Omni | ⬜ | ⬜ |
| phind-web | Omni | ⬜ | ⬜ |
| poe-web | Omni | ⬜ | ⬜ |
| venice-web | Omni | ⬜ | ⬜ |
| v0-vercel-web | Omni | ⬜ | ⬜ |
| kimi-web | Omni | ⬜ | ⬜ |
| doubao-web | Omni | ⬜ | ⬜ |
| veoaifree-web (video) | Omni | ⬜ | ⬜ |

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
| kimi-coding | Omni | 🟡 (backend có) | 🟡 |
| qoder | Omni | ⬜ | ⬜ |
| agy (Antigravity CLI) | Omni | ⬜ | ⬜ |
| amazon-q | Omni | ⬜ | ⬜ |
| gitlab-duo | Omni/CLIProxy | 🟡 (backend gitlab) | 🟡 |
| zed | Omni | ⬜ | ⬜ |
| trae | Omni | ⬜ | ⬜ |
| windsurf (Devin CLI) | Omni | ⬜ | ⬜ |
| devin-cli | Omni | ⬜ | ⬜ |
| xai-oauth (Grok Build) | CLIProxy | 🟡 (có xai apikey) | 🟡 |
| aistudio (AI Studio Build, WS) | CLIProxy | ⬜ | ⬜ |

---

## 10. PROVIDERS — Cloud agent (task-based API)

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| jules (Google Jules) | Omni | ⬜ | ⬜ |
| devin | Omni | ⬜ | ⬜ |
| codex-cloud | Omni | ⬜ | ⬜ |

---

## 11. PROVIDERS — Upstream proxy meta / System

| Provider | Nguồn | XLab | Trạng thái |
|----------|-------|:----:|:----------:|
| cliproxyapi (chain to CLIProxyAPI) | Omni | ⬜ | ⬜ |
| 9router (embedded) | Omni | ⬜ | ⬜ |
| auto (zero-config LKGP routing) | Omni | ⬜ | ⬜ |

---

## 12. Kế hoạch triển khai theo đợt

- **Đợt 1 (an toàn, giá trị cao):** Surface ~30 provider OmniRoute đã wired backend (mục 5.2) + thêm provider OpenAI-compatible mới (5.3) + local self-hosted (mục 6). Toàn bộ dùng default executor, có thể test bằng validate route.
- **Đợt 2:** Enterprise/cloud (5.4) cần providerSpecificData; image/video/music (mục 7).
- **Đợt 3:** OAuth/CLI vendor (mục 9) — mỗi cái 1 executor + OAuth flow.
- **Đợt 4:** Web-cookie scraper (mục 8) — cân nhắc ToS; cloud-agent (mục 10); upstream-proxy (mục 11).
- **Đợt 5:** Tính năng lõi còn thiếu: payload rules engine, WebSocket gateway, Amp CLI routes, Postgres/Git/S3 store, gamification, auto-combo optimizer.
