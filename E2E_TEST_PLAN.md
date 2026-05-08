# XLab Router - E2E Test Plan (User Perspective)

**Ngày:** 2026-05-08 22:16  
**Tester:** QA Team  
**Phiên bản:** 1.0.47  
**Môi trường:** Windows, Node.js v22.20.0, `run.bat` khởi động

---

## Test Scope - Tất cả tính năng theo README

### 1. Installation & Startup
- [ ] Global install: `npm i -g xlabrouter`
- [ ] Run global: `xlabrouter`
- [ ] Run npx: `npx xlabrouter`
- [ ] Local install: `npm install xlabrouter`
- [ ] Run.bat (Windows dev mode)
- [ ] CLI help: `xlabrouter --help`
- [ ] CLI version: `xlabrouter --version`
- [ ] Tray mode: `xlabrouter --tray`
- [ ] Web mode: `xlabrouter --web`
- [ ] Autostart on/off/status

### 2. Web Dashboard Access
- [ ] Dashboard loads: `http://localhost:1212`
- [ ] Dashboard responsive (desktop/mobile)
- [ ] Navigation menu works
- [ ] All pages load without error

### 3. Provider Management
- [ ] View providers list
- [ ] Connect FREE provider (Kiro/OpenCode/iFlow)
- [ ] Connect OAuth provider (Claude Code/Codex/Cursor)
- [ ] Add API key provider (OpenAI/Anthropic/Gemini)
- [ ] Multi-account per provider
- [ ] Edit provider settings
- [ ] Delete provider
- [ ] Test provider connection
- [ ] View provider quota/usage

### 4. Combo/Routing Rules
- [ ] View combos list
- [ ] Create new combo
- [ ] Edit combo (add/remove models)
- [ ] Set fallback order (tier 1 → 2 → 3)
- [ ] Set routing strategy (round-robin/priority/cost)
- [ ] Delete combo
- [ ] Test combo routing

### 5. API Endpoints (OpenAI-compatible)
- [ ] `/v1/models` - list models
- [ ] `/v1/chat/completions` - chat (stream=false)
- [ ] `/v1/chat/completions` - chat (stream=true)
- [ ] `/v1/completions` - text completion
- [ ] `/v1/embeddings` - embeddings
- [ ] `/v1/images/generations` - image generation
- [ ] `/api/health` - health check
- [ ] `/api/version` - version info

### 6. Format Translation
- [ ] OpenAI format → Claude format
- [ ] Claude format → OpenAI format
- [ ] OpenAI format → Gemini format
- [ ] Responses API format
- [ ] Cursor format
- [ ] Kiro format

### 7. OAuth Flows
- [ ] Claude Code OAuth login
- [ ] Codex OAuth login
- [ ] Cursor OAuth login/auto-import
- [ ] Kiro OAuth login
- [ ] Antigravity OAuth login
- [ ] GitHub Copilot OAuth
- [ ] Token auto-refresh

### 8. Multi-Account & Load Balancing
- [ ] Add 2+ accounts for same provider
- [ ] Round-robin between accounts
- [ ] Account quota tracking
- [ ] Account lock/unlock
- [ ] Fallback when account exhausted

### 9. Quota & Usage Tracking
- [ ] Real-time token count
- [ ] Cost estimation
- [ ] Reset countdown (5h/daily/weekly)
- [ ] Usage analytics dashboard
- [ ] Export usage logs

### 10. CLI Tool Integration
- [ ] Claude Code settings endpoint
- [ ] Codex settings endpoint
- [ ] OpenClaw settings endpoint
- [ ] Cursor settings endpoint
- [ ] Cline settings endpoint
- [ ] Antigravity MITM
- [ ] Cowork settings

### 11. Security & Auth
- [ ] API key generation
- [ ] API key validation
- [ ] PII sanitization (email/token/key masking)
- [ ] Local mode (no API key)
- [ ] Rate limiting
- [ ] Input validation

### 12. Error Handling & Fallback
- [ ] Provider timeout → fallback
- [ ] Provider 429 rate limit → fallback
- [ ] Provider 401 auth error → fallback
- [ ] Provider 500 error → fallback
- [ ] Network error → fallback
- [ ] Invalid model → fallback

### 13. Logging & Debugging
- [ ] Request/response logs
- [ ] Debug mode toggle
- [ ] Log file rotation
- [ ] Console output (colorlog.ps1)
- [ ] Error stack traces

### 14. Performance
- [ ] Response time < 3s (normal request)
- [ ] Streaming latency < 500ms (first token)
- [ ] Memory usage stable (no leak)
- [ ] CPU usage reasonable
- [ ] Concurrent requests (10+ parallel)

### 15. Build & Deploy
- [ ] `npm run build` success
- [ ] `npm run start` (production mode)
- [ ] `npm run dev` (dev mode)
- [ ] Standalone build works
- [ ] Docker build (if available)

### 16. Uninstall & Cleanup
- [ ] `npm run uninstall` script
- [ ] `npm run uninstall:full` script
- [ ] Registry cleanup
- [ ] File cleanup
- [ ] Service cleanup

---

## Test Execution Plan

### Phase 1: Core Functionality (30 phút)
1. Startup & CLI
2. Dashboard access
3. Provider connection (1 FREE provider)
4. Basic chat API test
5. Health check

### Phase 2: Provider & Routing (45 phút)
6. Add multiple providers
7. Create combo with fallback
8. Test routing strategies
9. Multi-account setup
10. Quota tracking

### Phase 3: Advanced Features (60 phút)
11. OAuth flows (2-3 providers)
12. Format translation tests
13. CLI tool integration
14. Error handling & fallback
15. Security tests

### Phase 4: Performance & Stability (30 phút)
16. Load test (concurrent requests)
17. Memory/CPU monitoring
18. Log file check
19. Long-running stability

### Phase 5: Edge Cases (30 phút)
20. Invalid inputs
21. Network failures
22. Provider outages
23. Quota exhaustion
24. Token expiration

---

## Test Results Template

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Startup via run.bat | ✅ PASS | Server on 1212 |
| 2 | Dashboard loads | 🔄 TESTING | ... |
| 3 | ... | ⏳ PENDING | ... |

---

## Bắt đầu test ngay

Mình sẽ chạy từng phase và cập nhật kết quả real-time.
