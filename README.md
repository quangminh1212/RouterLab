# XLab Router

XLab Router là bộ định tuyến AI đa nhà cung cấp, hỗ trợ gom endpoint, quota, fallback, tunnel và dashboard quản trị tập trung.

## Quick Start

```bash
npm install -g xlabrouter
xlabrouter
```

Hoặc chạy local:

```bash
npm install
npm run quality:gate
npm start
```

Dashboard mặc định: `http://localhost:1212`
API endpoint mặc định: `http://localhost:1212/v1`

## Tính năng chính

- Kết nối nhiều AI providers và nhiều loại model
- Route/fallback giữa provider, account, quota
- Dashboard quản lý endpoint, usage, quota, tunnel, providers
- Hỗ trợ CLI tools như Codex, Claude Code, Cursor, OpenCode, Copilot...
- Backup/restore local database và GitHub Gist backup
- Tunnel Cloudflare / Ngrok / Tailscale
- **Devin CLI**: native OpenAI path (`devin-cli` / `dvcli`) + Hermes package trong `hermes-devin-acp/` (provider `devin-acp`)

### Hermes Devin ACP (built-in package)

SoT: `C:\Dev\RouterLab\hermes-devin-acp` (vendored trong repo, không còn repo riêng).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\RouterLab\hermes-devin-acp\scripts\install.ps1
```

Chi tiết: `hermes-devin-acp/README.md`.

## Cấu trúc dữ liệu runtime

- Windows local data dir: `%APPDATA%\\xlabrouter`
- Linux server data dir: `~/.xlabrouter`
- Các file chính:
  - `db.json`
  - `request-details.json`
  - `usage.json` (nếu có)
  - `.session-secret`

## Docker

Build image:

```bash
docker build -t xlabrouter .
```

Run container:

```bash
docker run --rm \
  -p 20128:20128 \
  -v "$HOME/.xlabrouter:/app/data" \
  -e DATA_DIR=/app/data \
  --name xlabrouter \
  xlabrouter
```

## Quality gates

Trước khi merge hoặc deploy, chạy:

```bash
npm run quality:gate
```

Coverage gate cho module lõi:

```bash
npm run quality:gate:coverage
```

Coverage threshold hiện tại: 70% cho lines/functions/branches/statements trên core tuyến ổn định (chat/audio/messages/models/info/moderations/rerank/responses-compact/v1beta-models, health, requestDedup, embeddings core, claude header cache).

## Performance notes

Các tối ưu chính hiện có:

- Code splitting cho Monaco / Recharts / XYFlow
- Vendor/framework chunk splitting để giảm first-load bundle
- Dynamic imports cho modal và heavy components
- Heap limit + smart GC timer để giảm RAM bloat
- Cache nhẹ cho dashboard bootstrap

## Deploy VPS

Repo hiện dùng `deploy.bat` để build + pack + deploy lên VPS `157.66.100.194:1212`.

Nếu cần sync cả data, cần upload thêm từ local `%APPDATA%\\xlabrouter` lên VPS `~/.xlabrouter` rồi restart service.

## API nâng cao

### Batch API (OpenAI-compatible)
- `POST /v1/files` (multipart) — upload file JSONL (`purpose=batch`)
- `POST /v1/batches` — tạo batch (`input_file_id`, `endpoint`, `completion_window=24h`)
- `GET /v1/batches/:id` — xem trạng thái (validating → in_progress → finalizing → completed)
- `GET /v1/batches` — liệt kê batch
- `POST /v1/batches/:id/cancel` — hủy batch
- `GET /v1/files/:id` + `GET /v1/files/:id/content` — tải file kết quả (output/errors JSONL)
- Hỗ trợ endpoint: `/v1/chat/completions`, `/v1/embeddings`, `/v1/completions`

### A2A Protocol (Agent-to-Agent)
- `GET /.well-known/agent.json` — agent card (discovery)
- `POST /a2a` — JSON-RPC: `message/send`, `message/stream` (SSE), `tasks/get`, `tasks/cancel`
- `GET /api/a2a/status` — trạng thái protocol + thống kê task
- `GET /api/a2a/tasks`, `GET /api/a2a/tasks/:id`, `POST /api/a2a/tasks/:id/cancel`

Cả hai nhóm endpoint tuân theo `requireApiKey` trong settings.

## Changelog ngắn

### 2026-05
- Thêm OpenAI-compatible Batch API + Files API (`/v1/batches`, `/v1/files`)
- Thêm A2A (Agent-to-Agent) Protocol (`/.well-known/agent.json`, `/a2a`, `/api/a2a/*`)
- Thêm TamMao / CungCapAI provider và `x-machine-id`
- Sửa test model chậm cho CungCapAI
- Sửa lỗi reload form do button submit mặc định
- Sửa lỗi duplicate React key ở compatible models
- Sửa BOM JSON ở backup/import/GitHub CLI flow
- Tối ưu RAM với heap limit + smart GC timer
- Tối ưu bundle load bằng cách tách vendor/framework/common chunk nhỏ hơn

## Ghi chú nội bộ

- Không push remote tự động
- Deploy script nằm ở `deploy.bat`
- Dự án đang chạy production bằng `next build --webpack`

## License

ISC