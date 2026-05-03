# XLab Router Backup

## Mục tiêu

Backup dùng để khôi phục cấu hình XLab Router và số liệu Usage & Analytics ở mức tổng quan. Backup không lưu nội dung request/response chi tiết để tránh file quá nặng và hạn chế lưu dữ liệu nhạy cảm.

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
- `apiKeys`: API keys nội bộ của XLab Router.
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
