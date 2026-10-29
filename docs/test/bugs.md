# Báo cáo Lỗi (Bug Report) - 11Sport (v1.0)

> **Người lập**: QA/Tester Agent (`tester`)
> **Ngày cập nhật**: 2026-10-28
> **Trạng thái hiện tại**: **0 lỗi Chặn / Nghiêm trọng / Trung bình còn mở** (Tất cả lỗi phát hiện trong quá trình kiểm thử tích hợp đã được xử lý và kiểm thử hồi quy đạt 100%).

---

## 1. Thống kê Lỗi theo Mức độ

| Mức độ | Tổng phát hiện | Đã xử lý (Fixed & Verified) | Còn mở (Open) |
| --- | :---: | :---: | :---: |
| **Chặn (Blocker)** | 0 | 0 | **0** |
| **Nghiêm trọng (Critical)** | 0 | 0 | **0** |
| **Trung bình (Medium)** | 3 | 3 | **0** |
| **Nhẹ (Low)** | 1 | 1 | **0** |
| **Tổng cộng** | **4** | **4** | **0** |

---

## 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)

### BUG-01: Nút chuyển nhanh vai trò (Quick Login) trên `web/` và `cms/` gửi mật khẩu mặc định chưa khớp với dữ liệu Seed của `server/`
- **Mức độ**: Trung bình (Medium)
- **Thành phần**: `web/src/app/page.tsx`, `cms/src/app/page.tsx`
- **Các bước tái hiện**:
  1. Khởi chạy `server` (dữ liệu seed tạo `admin` với mật khẩu `admin123`, `sales1` và `warehouse1` với mật khẩu `123456`).
  2. Mở `web` hoặc `cms`, hệ thống gọi tự động `POST /api/v1/auth/login` với mật khẩu `"123"`.
- **Kết quả thực tế trước khi sửa**: API trả về `401 INVALID_CREDENTIALS`, khiến giao diện phải rơi vào nhánh `catch` (dùng `demo-token` fallback thay vì JWT token thật từ server).
- **Kết quả mong đợi**: Đăng nhập thành công `200 OK` và nhận JWT token thật từ `server`.
- **Trạng thái**: **ĐÃ SỬA & ĐÃ KIỂM THỬ LẠI (FIXED & VERIFIED)** — Đã đồng bộ mật khẩu demo trên `web/src/app/page.tsx` và `cms/src/app/page.tsx` khớp với `server/src/config/seed.ts`.

---

### BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`
- **Mức độ**: Trung bình (Medium)
- **Thành phần**: `web/src/components/ImportTab.tsx`
- **Các bước tái hiện**:
  1. Tại màn hình Nhập kho (`ImportTab`), tick xác nhận dòng hàng và bấm nút **"Hoàn thành nhập kho"**.
  2. Server trả về `{ data: { receipt: completedReceipt, movements: [...] }, meta: { ... } }`.
- **Kết quả thực tế trước khi sửa**: `handleSelectReceipt(res.data)` nhận cả object bọc `{ receipt, movements }` thay vì `res.data.receipt`, làm trạng thái phiếu đang chọn trên UI chưa hiển thị ngay nhãn `COMPLETED` cho tới khi bấm chọn lại từ danh sách bên trái.
- **Kết quả mong đợi**: UI đọc đúng `res.data?.receipt || res.data` và khóa phiếu ngay lập tức.
- **Trạng thái**: **ĐÃ SỬA & ĐÃ KIỂM THỬ LẠI (FIXED & VERIFIED)** — Đã cập nhật `ImportTab.tsx` trích xuất `res.data?.receipt || res.data`.

---

### BUG-03: Hiển thị mã phiếu Trả/Đổi trong thông báo thành công tại `ReturnExchangeTab.tsx`
- **Mức độ**: Nhẹ (Low)
- **Thành phần**: `web/src/components/ReturnExchangeTab.tsx`
- **Các bước tái hiện**:
  1. Tạo phiếu trả/đổi hàng qua `POST /api/v1/returns`.
  2. Server trả về `{ data: { returnExchange: createdRecord, order: updatedOrder } }`.
- **Kết quả thực tế trước khi sửa**: Thông báo thành công đọc `res.data?.code` nên hiển thị chuỗi mặc định `"Trả/Đổi"` thay vì mã phiếu cụ thể (`TH-0001` / `DH-0001`).
- **Kết quả mong đợi**: Hiển thị đúng mã phiếu vừa tạo từ `res.data?.returnExchange?.code`.
- **Trạng thái**: **ĐÃ SỬA & ĐÃ KIỂM THỬ LẠI (FIXED & VERIFIED)** — Đã cập nhật `ReturnExchangeTab.tsx`.

---

### BUG-04: Bảng hóa đơn khổ K80 bị tràn ngang do mã sản phẩm dài và dính nền trang khi bấm In PDF
- **Mức độ**: Trung bình (Medium)
- **Thành phần**: `web/src/components/InvoicePdfModal.tsx`, `cms/src/components/InvoicePdfModal.tsx`, `web/src/components/PosTab.tsx`
- **Các bước tái hiện**:
  1. Tạo đơn hàng có sản phẩm mang mã dài không khoảng trắng (VD: `AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L`).
  2. Mở Modal Hóa đơn PDF khổ K80 (`360px`) và bấm `In / Lưu PDF`.
- **Kết quả thực tế trước khi sửa**: Chuỗi mã hàng không có khoảng trắng làm cột `Mặt hàng` bị giãn rộng, đẩy các cột `SL`, `Đơn giá`, `Thành tiền` tràn ra ngoài mép phải của tờ bill K80; chữ `₫` bị rớt dòng; và `window.print()` trực tiếp làm ẩn thanh công cụ modal trong khi vẫn lộ nền trang POS phía sau.
- **Kết quả mong đợi**: Khổ K80 hiển thị gọn 100% trong khung giấy 80mm (`break-all` cho mã hàng, `whitespace-nowrap` cho số tiền `₫`), và khi bấm `In / Lưu PDF` mở cửa sổ in độc lập đúng khổ giấy (`80mm` hoặc `A4`) không dính nền phía sau.
- **Trạng thái**: **ĐÃ SỬA & ĐÃ KIỂM THỬ LẠI (FIXED & VERIFIED)** — Đã cập nhật `InvoicePdfModal.tsx` trên cả `web/` và `cms/`.

---

## 3. Kiểm thử Phi chức năng & Bảo mật cơ bản
- **Bảo mật xác thực & mật khẩu**: Mật khẩu nhân viên được băm SHA-256 kèm salt (`11sport_salt_`), trường `passwordHash` được loại bỏ hoàn toàn khỏi mọi phản hồi `GET /api/v1/staff`, `POST /api/v1/staff`, `PATCH /api/v1/staff/:id`.
- **Toàn vẹn dữ liệu tồn kho & tài chính**:
  - Chặn tuyệt đối sửa mã sản phẩm (`PRODUCT_CODE_IMMUTABLE`) và sửa tay tồn kho (`STOCK_DIRECT_EDIT_FORBIDDEN`).
  - Mọi giá trị tiền tệ (`sellingPrice`, `subtotal`, `cardFee`, `totalAmount`, `refundAmount`) đều được làm tròn số nguyên `VND` (`Math.round`), không xảy ra sai số dấu phẩy động.
  - Chặn bán vượt tồn kho (`INSUFFICIENT_STOCK`) và chặn trả vượt số lượng đã mua (`EXCEED_RETURNABLE_QUANTITY`).
