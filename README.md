# 🎓 EduFusion Studio – Hệ Thống Phân Loại Học Liệu Đa Phương Thức

> **Prototype Client-side mô phỏng kiến trúc EduFusionNet**  
> Phân loại học liệu số Việt Nam dựa trên tích hợp đa phương thức (Văn bản + Ảnh minh hoạ).  
> Trang tham khảo lý thuyết: [http://eduaitech.site/PoCs/edufusion_prototype.html](http://eduaitech.site/PoCs/edufusion_prototype.html)

---

## 📌 1. Giới thiệu tổng quan

**EduFusion Studio** là bản thử nghiệm (prototype) trực tiếp trên trình duyệt web, mô phỏng lại luồng hoạt động (pipeline) của mô hình học sâu **EduFusionNet**. Hệ thống tiếp nhận thông tin mô tả học liệu (tiêu đề/nội dung văn bản tiếng Việt) và ảnh minh hoạ số hoá, từ đó dự đoán môn học tương ứng trong chương trình đào tạo đại học/cao đẳng công nghệ thông tin và ngôn ngữ.

> ⚠️ **Lưu ý quan trọng (Disclaimer):**  
> Đây là bản prototype thử nghiệm phía Client-side chạy hoàn toàn trên trình duyệt, không đòi hỏi backend hay GPU. Để tối ưu hoá tính trực quan và khả năng trình diễn, các mô hình học sâu (PhoBERT, EfficientNet) được mô phỏng bằng **thuật toán Heuristic, Từ điển Lexicon và HTML5 Canvas API**. Kết quả dự đoán có giá trị minh hoạ cơ chế hợp nhất thông tin và xử lý dữ liệu thiếu (MEMD).

---

## 🏗️ 2. Kiến trúc mô phỏng EduFusionNet

Mô hình hoạt động theo mô hình tích hợp trễ (Late Fusion) với cơ chế phòng ngừa lỗi thiếu phương thức (Missing-Modality Handling):

```
                        ┌─────────────────────────────────────┐
                        │   Đầu vào học liệu đa phương thức    │
                        └──────────────────┬──────────────────┘
                                           │
                   ┌───────────────────────┴───────────────────────┐
                   ▼                                               ▼
     ┌───────────────────────────┐                   ┌───────────────────────────┐
     │   Nhánh Văn Bản (Text)    │                   │      Nhánh Ảnh (Image)    │
     │  (Mô phỏng PhoBERT frozen)│                   │  (Mô phỏng EfficientNet)  │
     └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                   │                                               │
                   │ • Chuẩn hoá text tiếng Việt                   │ • Canvas API trích pixel
                   │ • Khớp từ khoá n-gram (Lexicon)               │ • Sobel edge, Color entropy
                   │ • Softmax (Temperature = 1.5)                 │ • Sinh Attention Map 7×7
                   ▼                                               ▼
              Vector xác suất text                           Vector xác suất ảnh
              P_text = [p0..p6]                              P_image = [p0..p6]
                   │                                               │
                   └───────────────────────┬───────────────────────┘
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │    Khối tích hợp LCA (Late Confidence Aggregation)│
                 │              & Cơ chế MEMD Fallback               │
                 └─────────────────────────┬─────────────────────────┘
                                           │
       ┌───────────────────────────────────┼───────────────────────────────────┐
       ▼                                   ▼                                   ▼
 [Cả 2 Modality]                     [Chỉ có Text]                       [Chỉ có Ảnh]
 P = 0.65×P_text + 0.35×P_img        P = P_text (MEMD Fallback)          P = P_image (MEMD Fallback)
 Hiển thị Attention Map              Cảnh báo: Thiếu ảnh                 Cảnh báo: Thiếu văn bản
       │                                   │                                   │
       └───────────────────────────────────┼───────────────────────────────────┘
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │       Giám sát độ tin cậy (Human-in-the-Loop)     │
                 │     Nếu Max(P) < 0.50 ➔ Kích hoạt Cảnh báo Review │
                 └─────────────────────────┬─────────────────────────┘
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │    Kết xuất giao diện: Bar Chart + Attention 7×7  │
                 └───────────────────────────────────────────────────┘
```

---

## 📚 3. Danh mục 7 Môn học và Bộ Từ khoá (Lexicon)

Hệ thống hỗ trợ phân loại 7 môn học tiêu biểu:

| STT | Tên môn học | Nhóm từ khoá đặc trưng (Lexicon) | Đặc điểm ảnh minh hoạ |
|:---:|:---|:---|:---|
| 0 | **Tiếng Anh** | `grammar`, `vocabulary`, `ielts`, `toeic`, `listening`, `speaking`, `tense`, `passive voice` | Màu sắc tươi sáng, entropy cao |
| 1 | **Tiếng Nhật** | `kanji`, `hiragana`, `katakana`, `jlpt`, `n5`, `n4`, `nihongo`, `romaji`, `hán tự` | Sắc đỏ/hồng, bản đồ, văn hoá |
| 2 | **Toán rời rạc** | `đồ thị`, `graph`, `ma trận kề`, `tập hợp`, `mệnh đề`, `tổ hợp`, `đệ quy`, `chu trình`, `liên thông` | Nhiều đường nét, ma trận, công thức nền trắng |
| 3 | **Mạng máy tính** | `tcp/ip`, `osi`, `router`, `subnet`, `dns`, `firewall`, `packet`, `lan`, `wan`, `topology` | Sơ đồ mạng, đường nối nút, tông xám/xanh |
| 4 | **Cơ sở dữ liệu** | `sql`, `select`, `where`, `join`, `khoá chính`, `khoá ngoại`, `truy vấn`, `acid`, `transaction` | Bảng biểu dạng lưới, sơ đồ ER |
| 5 | **Kỹ thuật lập trình** | `vòng lặp`, `hàm`, `class`, `oop`, `mảng`, `c++`, `con trỏ`, `pointer`, `linked list`, `debug` | Nền tối (Dark editor), sắc xanh dương |
| 6 | **Thị giác máy tính** | `convolution`, `cnn`, `yolo`, `detection`, `segmentation`, `opencv`, `pixel`, `feature map`, `sobel` | Bounding box, ảnh vật thể, sắc xanh lá |

---

## 🚀 4. Hướng dẫn chạy cục bộ (Local Setup)

Dự án sử dụng chuẩn **ECMAScript Modules (ESM)** native của trình duyệt hiện đại (`import`/`export`), do đó cần một máy chủ HTTP tĩnh (static file server):

### Cách 1: Sử dụng VS Code Live Server (Khuyến nghị)
1. Cài đặt tiện ích mở rộng **Live Server** trên VS Code.
2. Mở thư mục `edufusion-studio` trong VS Code.
3. Nhấp chuột phải vào `index.html` chọn **Open with Live Server**.
4. Trình duyệt sẽ tự động mở tại `http://127.0.0.1:5500`.

### Cách 2: Sử dụng Python HTTP Server
```bash
# Di chuyển vào thư mục dự án
cd "g:\Demo Fusion"

# Khởi chạy server tại cổng 8080
python -m http.server 8080

# Truy cập trình duyệt: http://localhost:8080
```

### Cách 3: Sử dụng Node.js (npx serve)
```bash
npx serve "g:\Demo Fusion"
```

> ⚠️ Không mở trực tiếp bằng giao thức `file:///index.html` vì chính sách bảo mật CORS của trình duyệt sẽ chặn nạp ES Modules.

---

## 🧪 5. Kịch bản thử nghiệm (Test Cases nghiệm thu)

1. **Test case 1 (Toán rời rạc)**:
   - *Input:* Nhập `"Bài giảng về đồ thị có hướng và ma trận kề trong lý thuyết đồ thị"`
   - *Kết quả:* Nhãn dự đoán **Toán rời rạc** với độ tin cậy > 90%.

2. **Test case 2 (Cơ sở dữ liệu)**:
   - *Input:* Nhập `"SELECT * FROM students WHERE id = 1 ORDER BY created_at DESC"`
   - *Kết quả:* Nhãn dự đoán **Cơ sở dữ liệu** với độ tin cậy > 90%.

3. **Test case 3 (MEMD Fallback - Chỉ có ảnh)**:
   - *Input:* Để trống ô văn bản, bấm nút **🔢 Tạo ảnh công thức**. Bấm **Phân loại học liệu**.
   - *Kết quả:* Hệ thống kích hoạt cơ chế MEMD Fallback, hiện banner cảnh báo màu vàng: `"⚠️ Chỉ dùng nhánh ảnh (MEMD fallback – không có văn bản mô tả)"`. Dự đoán Toán rời rạc.

4. **Test case 4 (MEMD Fallback - Chỉ có văn bản)**:
   - *Input:* Nhập `"Mastering English grammar and vocabulary for IELTS speaking test"`, không tải ảnh.
   - *Kết quả:* Hiện banner `"⚠️ Chỉ dùng nhánh văn bản (MEMD fallback – không có ảnh minh hoạ)"`. Dự đoán Tiếng Anh.

5. **Test case 5 (Validation rỗng)**:
   - *Input:* Bỏ trống cả 2 ô văn bản và ảnh.
   - *Kết quả:* Báo lỗi rõ ràng: `"❌ Lỗi nhập liệu: Cần ít nhất 1 modality"`, không xảy ra crash ứng dụng.

6. **Test case 6 (Attention Overlay 7×7)**:
   - *Input:* Bấm nút **🗺️ Tạo ảnh bản đồ**, sau đó bấm **Phân loại học liệu**.
   - *Kết quả:* Canvas Attention Map bên phải hiển thị lưới 7×7 với các ô màu cam có độ đậm nhạt tương ứng với mức độ tập trung chi tiết của ảnh.

7. **Test case 7 (Human-in-the-Loop Review)**:
   - *Input:* Nhập một đoạn văn bản chung chung không khớp từ khoá nào (ví dụ: `"Buổi học giới thiệu tổng quan nhập môn"`).
   - *Kết quả:* Độ tin cậy thấp (< 50%), xuất hiện banner cảnh báo màu xanh lá: `"⚠️ Cần người review (Human-in-the-loop)"`.

---

## 📁 6. Cấu trúc thư mục mã nguồn

```
edufusion-studio/
├── index.html                   # Giao diện chính 2 cột (HTML5 semantic)
├── GEMINI.md                    # Workspace Rules & Tự động hoá Git
├── README.md                    # Tài liệu hướng dẫn và kiến trúc
├── css/
│   └── style.css                # Toàn bộ định kiểu, CSS Variables, Dark/Light Mode
├── js/
│   ├── lexicon.js               # Từ điển 7 môn học (30+ keywords/môn, weights 1-3)
│   ├── textBranch.js            # Mô phỏng PhoBERT (Chuẩn hoá tiếng Việt, Softmax)
│   ├── imageBranch.js           # Mô phỏng EfficientNet (Sobel edge, Color entropy, 7x7 map)
│   ├── fusion.js                # Bộ tích hợp LCA (0.65/0.35) & MEMD Fallback
│   ├── ui.js                    # Render DOM, Bar Chart, Attention Overlay, Dark Mode
│   └── app.js                   # Điểm khởi nhập chính, xử lý tương tác Canvas & Demo
└── assets/
    └── demo/
        ├── sample_inputs.json   # Tập mẫu thử nghiệm 7 môn học
        ├── graph_sample.svg     # Ảnh vector minh hoạ Đồ thị & Ma trận
        └── map_sample.svg       # Ảnh vector minh hoạ Bản đồ địa lý
```

---

## 💻 7. Công nghệ sử dụng (Tech Stack)

- **Ngôn ngữ:** Vanilla JavaScript (ES6+ Modules) – Không phụ thuộc thư viện/framework nặng.
- **Xử lý ảnh:** HTML5 Canvas 2D Context API (Sobel Convolution Filter 3×3, Shannon Color Entropy).
- **Giao diện:** CSS3 Flexbox & Grid, CSS Custom Properties (Theme tokens), Mobile Responsive.
- **Quản lý mã nguồn:** Git & GitHub.
