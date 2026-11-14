# Workspace Rules – EduFusion Studio

## Auto Git Commit & Push After Code Changes

**Quy tắc bắt buộc:** Sau mỗi lần hoàn thành tạo mới hoặc sửa đổi code **không có lỗi**, agent PHẢI tự động thực hiện toàn bộ các bước sau theo thứ tự, không cần người dùng nhắc:

### Các bước thực hiện (theo thứ tự)

1. **`git add -A`** — Stage toàn bộ thay đổi trong working directory.

2. **`git commit -m "<message>"`** — Commit với thông điệp mô tả rõ ràng theo định dạng:
   ```
   <type>: <mô tả ngắn gọn bằng tiếng Việt hoặc tiếng Anh>
   ```
   Trong đó `<type>` là một trong:
   - `feat` — thêm tính năng mới
   - `fix` — sửa lỗi
   - `refactor` — tái cấu trúc code
   - `style` — thay đổi về giao diện / CSS
   - `docs` — cập nhật tài liệu
   - `chore` — thay đổi cấu hình, build, v.v.

3. **`git push origin main`** — Đẩy commit lên nhánh `main` trên GitHub.

### Điều kiện áp dụng

- Áp dụng khi: tạo file mới, sửa nội dung file, xóa file, refactor code — miễn là **không có lỗi biên dịch / runtime** phát hiện được.
- **Không** áp dụng khi: thay đổi chỉ ở scratch files, file tạm, hoặc khi người dùng yêu cầu chạy thử nghiệm chưa hoàn chỉnh.
- Nếu `git push` thất bại (ví dụ: conflict, chưa xác thực), hãy báo ngay cho người dùng và hướng dẫn cách xử lý.

### Thông báo sau khi hoàn tất

Sau khi push thành công, agent thông báo ngắn gọn:
> ✅ **Đã commit & push:** `<commit message>`
