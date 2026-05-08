# XLab Router - Báo cáo kiểm thử tổng hợp

**Thời gian:** 2026-05-08 22:30 GMT+7  
**Dự án:** `C:\Dev\XLab_Router`  
**Phiên bản:** `xlabrouter@1.0.47`  
**Cách khởi chạy chính thức đã dùng:** `run.bat`  
**Mục tiêu:** Test lại toàn bộ tính năng như user thật và đối chiếu với các tính năng dự án đang có.

---

## 1. Kết luận nhanh

XLab Router **khởi chạy được, dashboard dùng được, API core hoạt động, build production thành công, npm audit sạch 0 vulnerabilities**.

Tuy nhiên, dự án **chưa đạt trạng thái release/stable enterprise** vì còn các vấn đề cần xử lý:

1. **Unit test suite đang fail trên Windows:** script mặc định dùng Unix path `/tmp/node_modules`; chạy bằng `npx vitest` thì vẫn fail 23/248 test.
2. **RTK/compression có dấu hiệu lệch giữa test và runtime:** test import `open-sse/rtk/index.js`, runtime thật dùng `src/lib/compression/rtk.js`; bootstrap báo `rtkEnabled:false`.
3. **Translator/request-normalization đang fail test:** nguy cơ lỗi với Claude/OpenAI format conversion ở vài case text array/SSE NDJSON.
4. **Cursor OAuth auto-import tests fail nhiều case:** có thể do test đang hardcode macOS/Linux expectation, chưa tương thích Windows.
5. **`/api/cli-tools/claude-settings` trả 500:** lỗi tích hợp Claude CLI settings cần sửa.
6. **`/api/health` có lúc trả degraded:** runtime guard phát hiện tình trạng degrade, cần expose verbose/debug tốt hơn để biết nguyên nhân trực tiếp.
7. **Chat API có auth trả 200 nhưng content rỗng trong một lần test với model combo `XLab`:** routing hoạt động nhưng UX/API response cần kiểm tra provider/translator.
8. **Một số route tài liệu/README bị lỗi encoding khi đọc bằng PowerShell mặc định:** không ảnh hưởng runtime nhưng ảnh hưởng trải nghiệm tài liệu.

---

## 2. Kết quả test đã chạy

### 2.1 Startup bằng `run.bat`

**Kết quả:** PASS

- `run.bat` stop process cũ trên port `1212` rồi start dev server.
- Server chạy ở `http://127.0.0.1:1212`.
- Log cho thấy dùng webpack dev server đúng script.

### 2.2 Health/API smoke

| Endpoint | Kết quả | Ghi chú |
|---|---:|---|
| `/api/health` | PASS/DEGRADED | Trả `ok:true`, nhưng có lúc `status:"degraded"` |
| `/api/version` | PASS | `currentVersion: 1.0.47` |
| `/v1/models` | PASS | Trả danh sách combo/models |
| `/` | PASS | HTTP 200 |
| `/dashboard` | PASS | HTTP 200 |
| `/api/dashboard/bootstrap` | PASS | Trả settings runtime |

Bootstrap settings ghi nhận:

```json
{
  "requireApiKey": true,
  "requireLogin": true,
  "tunnelDashboardAccess": true,
  "rtkEnabled": false,
  "cavemanEnabled": false,
  "cavemanLevel": "full"
}
```

### 2.3 CLI

| Command | Kết quả |
|---|---:|
| `node bin/xlab_router.js --help` | PASS |
| `node bin/xlab_router.js --version` | PASS, `1.0.47` |

Kết luận: lỗi BOM/syntax cũ trong `.tmp_start_web_err.log` là log cũ, file hiện tại không còn BOM và CLI chạy được.

### 2.4 Dashboard pages

| Page | Kết quả |
|---|---:|
| `/dashboard/providers` | PASS 200 |
| `/dashboard/combos` | PASS 200 |
| `/dashboard/token-saver` | PASS 200 |
| `/dashboard/cli-tools` | PASS 200 |
| `/dashboard/usage` | PASS 200 |
| `/dashboard/quota` | PASS 200 |
| `/dashboard/mcp-servers` | PASS 200 |
| `/dashboard/media-providers` | 404 | Route thực tế là `/dashboard/media-providers/[kind]`, không có index tổng |

### 2.5 Provider/config endpoints

| Endpoint | Kết quả | Ghi chú |
|---|---:|---|
| `/api/providers` | PASS 200 | Có connections/provider list |
| `/api/combos` | PASS 200 | Có combo `XLab`, `GPT`, `Claude`,... |
| `/api/models` | PASS 200 | Trả models |
| `/api/models/availability` | PASS 200 | Trả availability |
| `/api/keys` | PASS 200 | List API keys OK |
| `/api/keys` POST | PASS 201 | Tạo được key test `test-e2e-key` |
| `/api/cli-tools/openclaw-settings` | 401 | Cần auth, hợp lý nếu endpoint bảo vệ |
| `/api/cli-tools/claude-settings` | FAIL 500 | Cần sửa |
| `/api/usage/summary` | 404 | Route không tồn tại, route map dùng `/api/usage/stats`, `/api/usage/history`,... |
| `/api/quota` | 404 | Dashboard quota có page nhưng API này không tồn tại ở path này |

### 2.6 Chat API user-flow

Test request:

```http
POST /v1/chat/completions
Authorization: Bearer <local test key>
model: XLab
messages: [{ role: "user", content: "Say OK only" }]
stream: false
```

**Kết quả:** HTTP 200 nhưng `choices[0].message.content` rỗng.

```json
{
  "id": "chatcmpl-1778253550281",
  "object": "chat.completion",
  "model": "codex/gpt-5.5",
  "choices": [
    {
      "message": { "role": "assistant", "content": "" },
      "finish_reason": "stop"
    }
  ]
}
```

Nhận định:
- Auth OK.
- Combo routing OK.
- Upstream/provider được gọi.
- Nhưng response content rỗng là lỗi quan trọng cần điều tra ở provider response parser hoặc model/provider cụ thể.

### 2.7 Build production

Command: `npm run build`

**Kết quả:** PASS

Next.js build hoàn tất, route map sinh được nhiều route quan trọng:

- `/api/v1/chat/completions`
- `/api/v1/completions`
- `/api/v1/messages`
- `/api/v1/responses`
- `/api/v1/responses/compact`
- `/api/v1/embeddings`
- `/api/v1/images/generations`
- `/api/v1/audio/speech`
- `/api/v1/audio/transcriptions`
- `/api/v1/search`
- `/api/v1/web/fetch`
- `/api/v1beta/models`
- Dashboard/provider/usage/tunnel routes

Điểm quan trọng: dự án thực tế đã có nhiều API hơn đánh giá ban đầu, gồm cả audio/search/web fetch/compact response.

### 2.8 Security audit

Command: `npm audit --audit-level=moderate`

**Kết quả:** PASS

- `found 0 vulnerabilities`

Cảnh báo môi trường:

- Node warning: `NODE_TLS_REJECT_UNAUTHORIZED=0` đang được set, làm TLS insecure. Đây là cảnh báo quan trọng về môi trường/runtime.

### 2.9 Unit tests

Command mặc định:

```bash
npm test
```

**Kết quả:** FAIL trên Windows

Lý do script trong `tests/package.json` dùng cú pháp Unix:

```json
"test": "NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run --reporter=verbose"
```

Trên Windows lỗi:

```text
'NODE_PATH' is not recognized as an internal or external command
```

Command thay thế đã chạy:

```powershell
npx vitest run --reporter=verbose --dir=unit
```

**Kết quả:** FAIL

- Test files: 13 passed, 4 failed, 3 skipped, tổng 20
- Tests: 206 passed, 23 failed, 19 skipped, tổng 248

Nhóm fail chính:

1. `oauth-cursor-auto-import.test.js`
   - 8 fail
   - Lệch platform/path expectation macOS/Linux/Windows.

2. `rtk.test.js`
   - nhiều fail vì `setRtkEnabled is not a function`
   - Test import từ `open-sse/rtk/index.js`, trong khi runtime dùng `src/lib/compression/rtk.js`.
   - Cần đồng bộ test với module runtime thật hoặc restore API export.

3. `translator-request-normalization.test.js`
   - fail các case flatten text-only content arrays sang string
   - fail parse provider raw NDJSON stream line
   - Đây là nhóm đáng ưu tiên vì ảnh hưởng compatibility Claude/OpenAI/Gemini.

---

## 3. Feature map thực tế của dự án

Dựa trên README, route map, source tree và endpoint scan, XLab Router hiện có các nhóm tính năng:

### Core router
- Multi-provider routing
- Combo routing/fallback
- OpenAI-compatible API
- Claude/OpenAI/Gemini-ish translation layer
- API key auth
- Provider/account management
- Usage/logging/observability cơ bản

### Dashboard
- Providers
- Combos
- Endpoint settings
- Token saver
- CLI tools
- Usage/quota/logs
- MCP servers
- AI integrations/plugins/skills/memory/rules pages
- Proxy pools/tunnel/cloudflare/tailscale related APIs

### APIs thực tế
- Chat completions
- Text completions
- Claude messages
- Responses API
- Embeddings
- Images generation
- Audio speech/transcriptions
- Search
- Web fetch
- Token count
- Response compact

### CLI tool integrations
- Claude settings
- Codex settings
- OpenClaw settings
- Copilot settings
- Antigravity MITM
- OpenCode/Hermes/Droid/Cowork settings

### Compression/token saver
- Có dashboard và source code `src/lib/compression/rtk.js`, `src/lib/compression/caveman.js`
- Nhưng runtime bootstrap hiện báo disabled by default
- Unit test RTK đang fail do lệch import/API

---

## 4. So sánh với 9router / OmniRoute sau khi audit lại

Đánh giá ban đầu nói XLab thiếu nhiều multi-modal API là chưa chính xác hoàn toàn vì build route map cho thấy đã có audio/search/web/image/embedding.

Bảng cập nhật:

| Nhóm | XLab Router hiện tại | 9router | OmniRoute | Nhận định |
|---|---:|---:|---:|---|
| Multi-provider | Có | Có | Có | XLab ổn |
| Combo/fallback | Có | Có | Có | XLab ổn nhưng cần test sâu fallback lỗi thật |
| Multi-account | Có dấu hiệu có | Có | Có | Cần E2E thêm |
| API key auth | Có | Có | Có | OK |
| OpenAI-compatible chat | Có | Có | Có | OK nhưng có case content rỗng |
| Embeddings/images/audio/search/web fetch | Có route | Ít hơn | Có nhiều | XLab tốt hơn đánh giá ban đầu |
| RTK/Caveman compression | Có code/UI nhưng disabled/test fail | RTK mạnh | RTK+Caveman mạnh | Cần ưu tiên sửa |
| MCP/AI integrations | Có pages/config | Không rõ | Có mạnh | XLab có nền, cần test thực thi |
| Test coverage | 248 tests nhưng 23 fail | Không đối chiếu | Rất lớn | Cần ổn định CI/Windows |
| Desktop/PWA/mobile | Chưa xác nhận | Không chính | OmniRoute mạnh | Chưa ưu tiên trước core stability |
| Observability | Có runtime guard/log usage | Basic | Có | Cần expose debug tốt hơn |

---

## 5. Vấn đề Chrome/Chromium “bị fail”

Đã kiểm tra log cũ:

- Các lỗi Playwright/Chrome chủ yếu là WebSocket/HMR reconnect/refused khi dev server đã stop hoặc reload.
- Không thấy bằng chứng Chrome hệ thống hỏng.
- Canvas tool không dùng được trong môi trường hiện tại vì thiếu `node required`, không phải do Chrome của dự án.
- Kết luận tạm thời: vấn đề “Chrome fail” có khả năng là log cũ/dev-server disconnect, không phải blocker chính của XLab Router.

---

## 6. Ưu tiên xử lý tiếp theo

### P0 - Phải sửa trước khi coi là ổn định

1. Sửa `tests/package.json` để chạy cross-platform Windows/Linux/macOS.
   - Dùng `vitest run --reporter=verbose` thay vì hardcode `/tmp/node_modules`.
   - Nếu cần NODE_PATH thì dùng `cross-env` hoặc bỏ hẳn.

2. Sửa/đồng bộ RTK tests.
   - Quyết định module chuẩn: `src/lib/compression/rtk.js` hay `open-sse/rtk/index.js`.
   - Export/adapter `setRtkEnabled`, `isRtkEnabled`, `compressMessages` đúng như test hoặc cập nhật test theo runtime mới.

3. Sửa translator normalization.
   - Flatten text-only content arrays khi target provider cần string.
   - Parse raw NDJSON stream line để tránh mất streaming content.

4. Điều tra chat API content rỗng.
   - Test thêm với từng provider/model trong combo.
   - Kiểm tra parser `openai-compatible-responses` vì log cho thấy request route qua provider này.

5. Sửa `/api/cli-tools/claude-settings` 500.
   - Cần log error chi tiết hơn hoặc handle JSON/settings corrupt/null tốt hơn.

### P1 - Nâng chất lượng user-flow

6. Chuẩn hóa health verbose.
   - Cho phép debug reason degraded qua admin/dev mode.
   - Log rõ event loop lag/heap ratio.

7. Sửa docs/README encoding.
   - Đảm bảo UTF-8 no BOM, đọc tốt trên Windows terminal.

8. Tạo E2E test thật cho dashboard/API.
   - Playwright hoặc API smoke runner.
   - Test providers/combos/API keys/chat/streaming/fallback.

9. Test fallback thật.
   - Mock provider 429/401/500/timeout.
   - Xác nhận combo tự chuyển tier.

10. Test MCP/AI integrations/CLI tool integrations.
   - Không chỉ page load, cần test tạo settings và rollback an toàn.

---

## 7. Trạng thái file/thay đổi

Các file báo cáo/test plan đã tạo/cập nhật:

- `FEATURE_GAP_ANALYSIS.md`
- `E2E_TEST_PLAN.md`
- `FINAL_E2E_AUDIT_REPORT.md` (file này)

Git status tại thời điểm audit:

```text
## main...origin/main
 M FEATURE_GAP_ANALYSIS.md
?? E2E_TEST_PLAN.md
?? QA_SECURITY_STANDARDS.md
```

Lưu ý: `QA_SECURITY_STANDARDS.md` đã tồn tại untracked trước đó; chưa xác định do ai tạo. Không tự commit/push khi chưa có yêu cầu rõ.

---

## 8. Tóm tắt cho người quản lý

Nếu chỉ cần nắm nhanh:

- **Dự án chạy được:** Có.
- **Khởi chạy đúng bằng `run.bat`:** Có.
- **Dashboard vào được:** Có.
- **API core có hoạt động:** Có.
- **Build production:** Pass.
- **Security audit:** Pass, 0 vulnerabilities.
- **Đã đủ ổn để release enterprise chưa:** Chưa.
- **Lỗi lớn nhất:** test suite fail, RTK/compression lệch module, translator fail vài case, Claude settings 500, chat có case trả content rỗng.
- **Chrome có hỏng không:** Chưa thấy bằng chứng; khả năng là log cũ do server restart/HMR disconnect.
- **Việc cần làm ngay:** Sửa P0 phía trên rồi chạy lại full test.
