# 🎓 EduFusion Studio – Phân loại học liệu số đa phương thức (9 môn GDPT 2018)

> Prototype chạy hoàn toàn trên trình duyệt, minh hoạ quy trình của **EduFusionNet**: kết hợp **văn bản tiếng Việt** và **ảnh minh hoạ** để phân loại học liệu vào 1 trong 9 môn học bắt buộc của Chương trình giáo dục phổ thông 2018.

- Mã nguồn: [GITHUB_LINK – điền đường dẫn GitHub của bạn]
- Prototype tham chiếu của nhóm tác giả: http://eduaitech.site/PoCs/edufusion_prototype.html
- Bài báo gốc: Ma Ngan Giang, Tran Son Hai, Nguyen Kim Quoc (2026). _Integrating Image and Text Features for Vietnamese Digital Learning Material Classification: A Survey, the EduFusionNet Algorithm, and a Web Prototype_. Journal of Intelligent Decision Making and Information Science, 3(12s), 1822–1840.

> ⚠️ **Lưu ý:** Đây là bản **minh hoạ**. Chế độ Offline dùng từ điển từ khoá và đặc trưng Canvas (Sobel, entropy, màu sắc) để _mô phỏng_ PhoBERT và EfficientNet-B0; không có mạng nơ-ron nào được huấn luyện trong repo này. Kết quả dùng để minh hoạ cơ chế hợp nhất và xử lý thiếu phương thức, **không** phản ánh độ chính xác của EduFusionNet trong bài báo.

---

## 1. Tính năng

- **9 môn GDPT 2018:** Toán học, Vật lý, Hóa học, Sinh học, Tin học, Lịch sử, Địa lý, Ngữ văn, Tiếng Anh.
- **Hai chế độ phân loại**, chọn ở thanh đầu trang:
  - ⚡ **Offline (Heuristic Mock):** miễn phí, không cần mạng, không cần API key.
  - 🤖 **Google Gemini API (Multimodal):** gửi văn bản và/hoặc ảnh tới Gemini, nhận môn dự đoán, xác suất và lời giải thích.
- **Xử lý thiếu phương thức:** chỉ văn bản hoặc chỉ ảnh vẫn phân loại được, kèm banner cảnh báo.
- **Human-in-the-loop:** độ tin cậy dưới 50% sẽ hiện banner đề nghị giáo viên thẩm định.
- **Trực quan hoá:** biểu đồ xác suất 9 môn và Attention Map 7×7 phủ lên ảnh.
- **Bộ 90 mẫu** (mỗi môn 10 mẫu: 6 đa phương thức, 2 chỉ ảnh, 2 chỉ văn bản), có thể lưu thêm mẫu riêng vào LocalStorage.
- Giao diện Sáng/Tối, bố cục hai cột responsive.

---

## 2. Kiến trúc

```
        Văn bản mô tả                          Ảnh minh hoạ (canvas 224×224)
              │                                          │
   ┌──────────▼──────────┐                    ┌──────────▼──────────┐
   │  textBranch.js      │                    │  imageBranch.js     │
   │  Lexicon + softmax  │                    │  Sobel, entropy,    │
   │  (T = 1.5)          │                    │  màu, softmax (1.2) │
   └──────────┬──────────┘                    └──────────┬──────────┘
              │ P_text (9 chiều)                         │ P_image (9 chiều) + Attention 7×7
              └───────────────────┬──────────────────────┘
                                  ▼
                   ┌───────────────────────────────┐
                   │  fusion.js                    │
                   │  Cả hai: 0.65·P_text+0.35·P_img│
                   │  Một nhánh: dùng nguyên nhánh │
                   │  confidence < 0.5 → cần review│
                   └──────────────┬────────────────┘
                                  ▼
                       ui.js: nhãn, độ tin cậy,
                       biểu đồ, Attention Map, banner

   Chế độ Gemini: geminiService.js thay thế hai nhánh và khối hợp nhất ở trên;
   Attention Map vẫn tính cục bộ bằng imageBranch.js.
```

**Đối chiếu với bài báo:**

| Khía cạnh         | EduFusionNet (bài báo)                    | EduFusion Studio (repo này)                                                           |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Mã hoá văn bản    | PhoBERT đóng băng                         | Từ điển từ khoá có trọng số 1–3 + softmax                                             |
| Mã hoá ảnh        | EfficientNet-B0 tinh chỉnh                | Sobel, entropy Shannon, màu trung bình                                                |
| Hợp nhất          | LCA = _Lightweight Cross-modal Attention_ | Trung bình có trọng số 0.65 / 0.35 (`fusion.js` gọi là _Late Confidence Aggregation_) |
| Attention Map     | Lấy từ trọng số chú ý của LCA             | Lấy từ phương sai độ sáng từng khối ảnh                                               |
| Thiếu phương thức | Huấn luyện bằng MEMD                      | Quy tắc dự phòng + banner cảnh báo                                                    |

---

## 3. Cấu trúc thư mục

```
edufusion-studio/
├── index.html              # Giao diện chính
├── GEMINI.md               # Quy tắc workspace (tự động commit & push)
├── README.md
├── package.json
├── css/
│   └── style.css           # Theme Sáng/Tối, layout hai cột
├── js/
│   ├── lexicon.js          # SUBJECTS (9 môn) + từ điển từ khoá
│   ├── textBranch.js       # Nhánh văn bản (mô phỏng PhoBERT)
│   ├── imageBranch.js      # Nhánh ảnh (mô phỏng EfficientNet) + Attention Map
│   ├── fusion.js           # Hợp nhất 0.65/0.35, dự phòng, ngưỡng review
│   ├── geminiService.js    # Gọi Gemini Multimodal API
│   ├── ui.js               # Kết xuất DOM, biểu đồ, Attention Map, theme
│   ├── defaultSamples.js   # Mẫu tích hợp sẵn (export DEFAULT_SAMPLES)
│   └── app.js              # Điểm khởi nhập, điều phối luồng xử lý
└── assets/demo/
    ├── sample_inputs.json  # Bộ 90 mẫu (nạp thêm bằng fetch)
    └── image/              # Ảnh mẫu: Toan_1.png, Lich_Su_1.png, ...
```

---

## 4. Chạy cục bộ

Dự án dùng ES Modules nên **phải chạy qua máy chủ HTTP tĩnh**, không mở trực tiếp bằng `file://`.

```bash
# Cách 1: Node.js
npx serve .

# Cách 2: Python
python -m http.server 8080
# rồi mở http://localhost:8080

# Cách 3: VS Code → cài Live Server → chuột phải index.html → Open with Live Server
```

Kiểm tra nhanh việc nạp module: `npm test`.

---

## 5. Sử dụng

1. Chọn một mẫu ở **Dataset Demo**, hoặc nhập văn bản (tối thiểu 3 ký tự) và/hoặc tải ảnh (nhấp canvas, kéo – thả, hoặc nút _Tải ảnh từ máy_).
2. Bấm **Phân loại học liệu** (chọn mẫu hoặc mẫu nhanh sẽ tự động phân loại).
3. Xem môn dự đoán, độ tin cậy, phân phối xác suất 9 môn và Attention Map.
4. Muốn giữ lại nội dung đang nhập, bấm **Lưu nội dung này thành Mẫu mới** (lưu trong LocalStorage của trình duyệt).

### Dùng chế độ Gemini

1. Lấy API key tại [Google AI Studio](https://aistudio.google.com/).
2. Chọn **Google Gemini API (Multimodal)** ở đầu trang, dán key, bấm **Lưu Key**.
3. Phân loại như bình thường.

> 🔐 Key được lưu trong LocalStorage và gửi trực tiếp từ trình duyệt, nên **chỉ dùng key cá nhân/thử nghiệm**. Văn bản và ảnh học liệu sẽ được gửi tới Google. Nếu triển khai thật, hãy chuyển lời gọi qua một máy chủ trung gian.
>
> Danh sách mô hình thử lần lượt nằm ở biến `models` trong `js/geminiService.js`; cập nhật tên mô hình khi Google ngừng hỗ trợ.

---

## 6. Kịch bản kiểm thử thủ công

| #   | Thao tác                                                                   | Kết quả mong đợi                                                 |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Chọn mẫu _Lịch sử – đa phương thức_                                        | Hiện môn dự đoán, biểu đồ 9 môn và Attention Map                 |
| 2   | Chỉ nhập văn bản `Khảo sát hàm số, tính đạo hàm và tìm cực trị`, không ảnh | Dự đoán Toán học; banner vàng "Chỉ dùng nhánh văn bản"           |
| 3   | Chỉ bấm **Tạo ảnh Toán**, để trống văn bản                                 | Banner vàng "Chỉ dùng nhánh ảnh"; có Attention Map               |
| 4   | Bấm **Tạo ảnh Địa lý** + nhập mô tả bản đồ khí hậu Việt Nam                | Đa phương thức, nghiêng về Địa lý                                |
| 5   | Nhập `Buổi học giới thiệu tổng quan nhập môn`                              | Không khớp từ khoá, xác suất gần đều, hiện banner **cần review** |
| 6   | Bỏ trống cả văn bản và ảnh, bấm phân loại                                  | Báo lỗi "Cần ít nhất 1 modality", ứng dụng không crash           |
| 7   | Chế độ Gemini, không có API key                                            | Báo thiếu key, gợi ý chuyển về chế độ Offline                    |
| 8   | Bấm **Lưu thành Mẫu mới**, tải lại trang                                   | Mẫu vẫn còn trong danh sách                                      |

> Heuristic Offline chỉ là minh hoạ nên một số mẫu có thể bị phân loại sai (ví dụ nhầm Toán – Vật lý, Lịch sử – Địa lý); đó là hành vi dự kiến của nhánh giả lập.

---

## 7. Hạn chế đã biết

- Chưa có đánh giá định lượng (accuracy, macro-F1) trên bộ 90 mẫu.
- Từ điển chỉ khoảng 25–31 từ khoá mỗi môn, chưa tách từ bằng VnCoreNLP và chưa chuẩn hoá Unicode.
- Attention Map chỉ phản ánh biến thiên độ sáng, không giải thích quyết định của mô hình.
- Giao diện mới hiển thị phân phối sau hợp nhất, chưa hiển thị điểm riêng từng nhánh.

**Hướng phát triển:** script đánh giá tự động trên bộ mẫu; thay nhánh giả lập bằng mô hình EduFusionNet đã huấn luyện (ONNX hoặc API riêng); máy chủ trung gian cho Gemini; mở rộng từ điển từ dữ liệu.

---

## 8. Quy ước làm việc với Git

Theo `GEMINI.md`, sau mỗi thay đổi không lỗi: `git add -A` → `git commit -m "<type>: <mô tả>"` → `git push origin main`, với `type` ∈ `feat`, `fix`, `refactor`, `style`, `docs`, `chore`.

---

## 9. Công nghệ

JavaScript thuần (ES6 Modules), HTML5 Canvas 2D API, CSS3 (Grid, Flexbox, Custom Properties), Google Gemini REST API. Không dùng framework hay thư viện ngoài.

## Nguồn dữ liệu ảnh minh hoạ

Toàn bộ các ảnh trong `assets/demo/image/` được **trích từ sách giáo khoa Chương trình giáo dục phổ thông 2018** và chỉ dùng cho mục đích **học tập, nghiên cứu và minh hoạ** prototype. Bản quyền các hình ảnh này thuộc về tác giả và nhà xuất bản của từng cuốn sách; dự án không có quyền cấp phép lại cho chúng.

Nếu bạn là chủ sở hữu bản quyền và muốn gỡ ảnh, vui lòng liên hệ qua email maianhlenguyen08@gmail.com , ảnh sẽ được xoá ngay.
