# RouterLab Backup

## Mục tiêu

Backup dùng để khôi phục cấu hình RouterLab và số liệu Usage & Analytics ở mức tổng quan. Backup không lưu nội dung request/response chi tiết để tránh file quá nặng và hạn chế lưu dữ liệu nhạy cảm.

## File backup

- `xlabrouter.enc.json`: bản backup mã hóa dùng cho GitHub Gist.
- `xlabrouter.importable.json`: bản JSON có thể import trực tiếp qua UI/API database.
- `xlabrouter.usage-overview.json`: bản chỉ chứa số liệu Usage Overview.

## Luồng GitHub Gist

- Backup được mã hóa bằng `aes-256-gcm`.
- Khóa mã hóa sinh từ passphrase qua `pbkdf2-sha256` với `210000` iterations.
- File trên Gist mặc định là `xlabrouter.enc.json`.
- Nếu đã có Gist backup thì app cập nhật bằng `PATCH` để giữ revision history.
- Nếu chưa có Gist backup thì app tạo Gist mới một lần, các lần sau cập nhật cùng Gist đó.

## Dữ liệu được backup

### Database chính

Backup giữ các nhóm dữ liệu chính trong local DB:

- `providerConnections`: danh sách kết nối provider/account.
- `providerNodes`: danh sách provider node.
- `proxyPools`: cấu hình proxy pool.
- `modelAliases`: alias model.
- `mitmAlias`: alias MITM/router.
- `combos`: combo model/router.
- `apiKeys`: API keys nội bộ của RouterLab.
- `settings`: cấu hình ứng dụng.
- `pricing`: dữ liệu giá/model pricing.
- `customModels`: model tùy chỉnh nếu có.

### Usage & Analytics Overview

Backup giữ đủ dữ liệu cho tab `Overview`:

- `usage.dailySummary`: thống kê theo ngày.
- `usage.totalRequestsLifetime`: tổng request all-time.
- `database.usageData.dailySummary`: bản usage summary trong DB chính.
- `database.usageData.totalRequestsLifetime`: tổng request all-time trong DB chính.

Trong `dailySummary`, backup giữ các số tổng hợp:

- tổng requests theo ngày.
- input tokens / output tokens theo ngày.
- cost theo ngày.
- breakdown theo provider.
- breakdown theo model.
- breakdown theo account.
- breakdown theo API key.
- breakdown theo endpoint.

### CLI tool settings

Backup giữ cấu hình các CLI tool:

- `claudeCli`
- `codexCli`
- `openCodeCli`
- `openClawCli`
- `droidCli`
- `copilotCli`

## Dữ liệu không backup

### Request/response details

Backup không lưu dữ liệu chi tiết của tab `Details`:

- `requestDetails`
- `database.requestDetailsData.records`
- request body người dùng.
- provider request đã translate.
- provider raw response.
- client final response content.
- thinking content trong response.

### Usage request history chi tiết

Backup không lưu từng request usage riêng lẻ:

- `usage.history`
- `database.usageData.history`

Lý do: Overview chỉ cần số tổng hợp theo ngày và all-time. History từng request làm file backup rất lớn và có thể chứa thông tin nhạy cảm như apiKey, endpoint, timestamp, model, token từng request.

## Hành vi khi restore

- Restore bundle sẽ import lại database chính.
- Restore usage sẽ giữ `dailySummary` và `totalRequestsLifetime` để Overview hiển thị lại tổng usage.
- Restore sẽ chủ động xóa request details cũ nếu backup không chứa `requestDetails`.
- Sau restore, tab `Details` có thể trống; đây là hành vi chủ đích.

## Quy tắc hiện tại

Backup phải đảm bảo:

- `Overview` có đủ số tổng theo ngày và all-time.
- `Details` không được lưu request/response chi tiết.
- File backup không chứa từng usage request riêng lẻ.
- Gist backup lần đầu được tạo mới nếu chưa có, sau đó luôn update cùng Gist để giữ history.

## Tối ưu lưu trữ (Storage compaction)

Dữ liệu runtime được lưu trong thư mục data của ứng dụng (`%APPDATA%\xlabrouter` trên Windows, `~/.xlabrouter` trên macOS/Linux).

### Giới hạn dung lượng

`request-details.json` (tab `Details`) được giới hạn cứng để file không phình to:

- Tối đa `200` records (mặc định cấu hình `80`).
- Tối đa `64KB` cho mỗi field lớn (`request`, `providerRequest`, `providerResponse`, `response`); field vượt ngưỡng bị thay bằng marker `{ _truncated: true, _originalSize, _preview }`.
- Tối đa `12MB` cho toàn bộ file; nếu vượt, số records bị cắt giảm dần.

`db.json` chỉ giữ cấu hình + usage summary. Khối `requestDetailsData` cũ (nếu còn sót từ bản cũ hoặc do import/sync) sẽ bị xóa tự động khi DB được nạp.

### Tự phục hồi (self-heal)

Khi nạp lần đầu trong mỗi tiến trình, `request-details.json` được nén lại theo các giới hạn trên rồi ghi đè. File cũ quá khổ (từ bản cũ hoặc dữ liệu import) sẽ tự co lại ở lần chạy kế tiếp mà không cần thao tác thủ công.

### Script dọn dẹp thủ công

Khi cần thu hồi dung lượng ngay (ví dụ file đã phình tới hàng chục–hàng trăm MB từ bản cũ), dùng:

```bash
# Báo cáo (dry-run, không ghi gì)
npm run usage:compact

# Áp dụng: nén request-details.json + xóa blob requestDetailsData khỏi db.json
npm run usage:compact:apply

# Áp dụng và xóa luôn các file snapshot cũ (db.backup-*, db.vps-latest.json, ...)
node scripts/compact-usage-store.mjs --apply --prune-backups
```

Lưu ý an toàn:

- Mặc định là dry-run; chỉ ghi khi có `--apply`.
- Luôn tạo bản `*.bak-<timestamp>` trước khi sửa file live.
- Xóa snapshot cũ cần cờ riêng `--prune-backups`.
- Nên dừng tiến trình RouterLab trước khi chạy `--apply` để tránh tranh chấp ghi file.

## Nhập usage từ Cockpit (Antigravity Cockpit Tools)

Với các tài khoản mà RouterLab chỉ giữ token để chat (không có quyền đọc quota API của nhà cung cấp), panel **Antigravity Cockpit** là nơi duy nhất thấy được usage. Có thể export từ Cockpit rồi nhập vào RouterLab để cộng dồn vào tổng usage.

### Định dạng file export được hỗ trợ

Parser nhận diện nhiều dạng, ưu tiên cao nhất là **Cockpit Tools data-transfer** (`schema: "cockpit-tools.data-transfer"`):

```
{
  "schema": "cockpit-tools.data-transfer",
  "exported_at": "2026-05-31T...Z",
  "accounts": { "platforms": { "<platform>": { "exported_data": [ <account>, ... ] } } }
}
```

Đây là **snapshot quota/credit theo từng account** (không phải lịch sử request theo ngày). RouterLab suy ra số "đơn vị đã dùng" cho mỗi account:

- **kiro**: `credits_used` + `bonus_used`.
- **github-copilot / windsurf**: tổng `entitlement - quota_remaining` qua các quota có giới hạn (bỏ qua quota `unlimited`).
- **codex**: chỉ có `%` đã dùng (`hourly_percentage`/`weekly_percentage`) → không suy ra được số tuyệt đối → **bỏ qua** (không đoán).

Các dạng khác cũng được hỗ trợ: mảng record/event theo ngày, map quota theo model, và chính file `dailySummary` của RouterLab (re-import).

### API

```
POST /api/usage/cockpit-import
```

- Body `{ "preview": true, "export": <file> }` → tính tổng và trả về (dry-run), KHÔNG ghi.
- Body `{ "export": <file> }` → cộng dồn vào `dailySummary` + `totalRequestsLifetime`.

Usage nhập vào được gắn nhãn `source: "cockpit"` và gom theo bucket account `cockpit:<platform>:<email>` để không lẫn với account theo dõi nội bộ. Thao tác **idempotent**: import lại đúng file (hash trùng) sẽ không cộng đôi.
