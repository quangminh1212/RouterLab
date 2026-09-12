# AUDIT ĐỘC LẬP CH21–25 SAU PATCH

## Verdict: BLOCK

Không thể nghiệm thu dải Ch21–25. Workspace chỉ có Ch21 và Ch23; thiếu Ch20, Ch22, Ch24, Ch25, Ch26. `git diff` rỗng vì toàn bộ thư mục truyện đang untracked, nên không có patch/diff khả dụng để đối chiếu.

## Phạm vi thực đọc

- Đã đọc toàn văn `Chương 21 - Mở rộng làm giày.txt`.
- Đã đọc toàn văn `Chương 23 - Sản xuất túi xách.txt`.
- Không thể đọc Ch20/22/24/25/26: không tồn tại trong workspace.
- Không thể audit diff: `git diff --name-only` và `git diff --stat` không có nội dung.

## Kiểm định

| Tiêu chí | Ch21 | Ch22 | Ch23 | Ch24 | Ch25 |
|---|---:|---:|---:|---:|---:|
| >3000 từ | PASS — 4.649 token tách trắng | BLOCK — thiếu file | PASS — 4.742 token tách trắng | BLOCK — thiếu file | BLOCK — thiếu file |
| Mốc 1984 | Có | Không kiểm | Có | Không kiểm | Không kiểm |
| Ledger/system ledger | Có panel ghi `system_ledger` | Không kiểm | Có panel ghi `system_ledger` | Không kiểm | Không kiểm |
| Đúng 1 panel | PASS — 1 | Không kiểm | PASS — 1 | Không kiểm | Không kiểm |
| Ch21 `+90` đúng một lần | PASS — đúng 1 lần | — | — | — | — |
| Continuity Ch20→26 | BLOCK — thiếu 20/22/24/25/26 | BLOCK | BLOCK | BLOCK | BLOCK |
| Title payoff | FAIL — chủ yếu nhắc lại tiêu đề; thiếu diễn tiến mở rộng cụ thể | Không kiểm | FAIL — chủ yếu nhắc lại tiêu đề; thiếu diễn tiến sản xuất cụ thể | Không kiểm | Không kiểm |
| Không filler/template | FAIL | Không kiểm | FAIL | Không kiểm | Không kiểm |
| Không cụt | WARN — đoạn cuối bị tách câu cơ học trước panel | Không kiểm | WARN — cùng lỗi | Không kiểm | Không kiểm |

## Lỗi chặn nội dung

### 1. Template/filler quy mô lớn

Ch21 và Ch23 dùng gần như cùng khung, cùng thứ tự ý, cùng nhiều câu nguyên văn; chỉ thay tiêu đề, địa điểm, trở ngại, tên phụ. Các đoạn “chi tiết số 30–40” lặp nguyên cấu trúc nhiều lần. Đây là padding để vượt ngưỡng, không phải cảnh truyện phát triển.

Mẫu lặp rõ:

- “Trong … năm 1984 tại …, chi tiết số … gắn với …”
- “Hùng yêu cầu có bằng chứng cụ thể … trước khi tin.”
- “Cảm xúc … được ông để ý như đèn báo, không như tay lái.”
- “Kết thúc đoạn này … có thêm một việc đã giao rõ tên, rõ hạn, rõ cách kiểm.”
- Nhiều biến thể lặp của “Tin đồn bảo…”, “Ông kiểm tra lại chỗ dễ gian…”, “Khi trời… ông hỏi…”, “Cuối buổi… để lại bằng chứng…”.

### 2. Title payoff không đạt

- Ch21 không dựng được quyết định mở rộng: thiếu công suất trước/sau, vốn, máy móc, lao động, nguyên liệu, đơn hàng, rủi ro, mốc vận hành, kết quả kiểm chứng.
- Ch23 không dựng được quy trình sản xuất túi xách: thiếu thiết kế/mẫu, vật liệu, cắt may, máy, QC, định mức, sản lượng, đầu ra. “Túi xách” gần như chỉ tồn tại trong nhãn lặp.

### 3. Continuity/ledger không thể xác nhận

Panel riêng lẻ ghi:

- Ch21: `Tổng EXP: 990 (+90 nhịp này)`, kho `1,640m² (+40m²)`.
- Ch23: `Tổng EXP: 1,170 (+90 nhịp này)`, kho `1,720m² (+40m²)`.

Hai số ngầm cho thấy Ch22 có thể là EXP 1.080, kho 1.680m², nhưng file Ch22 vắng nên không được phép suy diễn là ledger khớp. Ch20/24/25/26 cũng vắng; continuity hai đầu và toàn dải chưa chứng minh.

### 4. Lệch bối cảnh 1984

Cả hai chương có chi tiết hiện đại/không được giải thích trong bối cảnh 1984: “để điện thoại xuống”, “checklist”, “banner”, “sổ khớp ngân hàng”, “hệ thống nháy”. Hệ thống có thể thuộc premise, nhưng điện thoại/checklist/banner/ngôn ngữ doanh nghiệp hiện đại gây gãy niên đại nếu không có thiết lập rõ từ chương kề.

### 5. Văn bản có dấu hiệu sinh tự động/chưa biên tập

- Trộn ngoặc kép cong với `\"`.
- Cụm placeholder: “khách/đối tác”, “phố/làng”, “khu vực việc”.
- Mệnh đề chung chung, thay thế được giữa hai chương mà không đổi cốt truyện.
- Ch21 dòng cuối thân bài và Ch23 dòng cuối thân bài bị ngắt đoạn bất tự nhiên ngay trước câu kết mẫu/panel.

## Kết luận

**BLOCK.** Điều kiện tối thiểu để audit lại: cung cấp đủ Ch20–26 cùng diff/patch thực; loại padding/template; viết lại payoff riêng cho từng tiêu đề; chứng minh ledger liên chương; xử lý chi tiết lệch 1984; giữ đúng một panel/chương và Ch21 `+90` đúng một lần.

Audit chỉ tạo file này. Không sửa chương. Không commit.
