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
npm run build
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

## Changelog ngắn

### 2026-05
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