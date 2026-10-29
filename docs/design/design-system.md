# Design System - 11Sport (POS, Kho & CMS)

> **Người lập**: UI/UX Designer Agent (`11sport-designer`)

## 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS)
- **Tinh thần**: Năng động, tốc độ thao tác cao tại quầy thu ngân/kho, tương phản rõ ràng đạt chuẩn WCAG AA, vùng bấm tối thiểu `44x44px` hỗ trợ cảm ứng điện thoại/máy tính bảng khi kiểm kho bằng Camera.

## 2. Bảng màu (Color Tokens - TailwindCSS)
- **Primary (11Sport Emerald/Volt)**:
  - `primary-600`: `#059669` (Nút hành động chính: Thanh toán, Hoàn thành nhập kho)
  - `primary-700`: `#047857` (Hover)
  - `primary-50`: `#ECFDF5` (Nền badge/highlight)
- **Secondary / Brand Dark**:
  - `slate-900`: `#0F172A` (Sidebar, Header POS, văn bản chính)
  - `slate-800`: `#1E293B`
- **Semantic Status**:
  - `success`: `#10B981` (Đã hoàn thành, Khớp kho, Đã thanh toán)
  - `warning`: `#F59E0B` (Đang kiểm, Chênh lệch kho, Trả một phần, Giá bán = 0)
  - `danger`: `#EF4444` (Hết hàng, Hỏng/Lỗi, Khóa tài khoản, Ngừng sử dụng)
  - `info`: `#3B82F6` (Nháp, Tra cứu, In PDF)

## 3. Typography & Định dạng hiển thị
- **Font chữ**: `Inter` / `System UI` cho giao diện; `JetBrains Mono` / `monospace` cho **Mã sản phẩm**, **Mã đơn hàng**, **Số điện thoại** và **Số tiền VND**.
- **Định dạng tiền tệ**: Hiển thị phân cách hàng nghìn theo chuẩn Việt Nam (VD: `1.030.000 ₫`).
- **Định dạng Mã sản phẩm**: Hiển thị badge monospace rõ ràng (VD: `AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L`).

## 4. Các Component cốt lõi
1. **Camera Scanner Modal (OCR & Tag Check)**:
   - Hỗ trợ bật Camera thiết bị (`navigator.mediaDevices.getUserMedia`), tải ảnh chứng từ/tag, hoặc dùng mẫu mô phỏng nhanh khi máy tính không cắm camera.
   - Luôn hiển thị bảng kết quả xem trước để thủ kho chỉnh sửa trước khi xác nhận.
2. **Bảng 6 cột Phiếu nhập kho**:
   - Cho phép chỉnh sửa inline (`STT`, `MÃ HÀNG` tự sinh từ `()` trong `TÊN HÀNG`, `ĐVT`, `SỐ LƯỢNG`, `GHI CHÚ`), nút thêm dòng, xóa dòng, lưu nháp.
3. **Bản in Hóa đơn PDF (Print/PDF Preview)**:
   - Nút chuyển đổi trực tiếp giữa **Khổ K80 (80mm)** và **Khổ A4**, gọi hộp thoại in/lưu PDF chuẩn.
