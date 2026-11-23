# Design System - 11Sport (POS, Kho & CMS)

> **Người lập**: UI/UX Designer Agent (`11sport-designer`)

## 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS)
- **Tinh thần**: Năng động, tốc độ thao tác cao tại quầy thu ngân/kho, tương phản rõ ràng đạt chuẩn WCAG AA, vùng bấm tối thiểu `44x44px` hỗ trợ cảm ứng điện thoại/máy tính bảng khi kiểm kho bằng Camera.

## 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App)
- **Web POS & Kho vận (`web/` — White & Royal Blue `blue`)**:
  - `primary-600` (`blue-600`): `#2563EB` · `primary-700` (`blue-700`): `#1D4ED8` (Nút Thanh toán, tab đang chọn, Menu POS)
  - `primary-50` (`blue-50`): `#EFF6FF` · `primary-100` (`blue-100`): `#DBEAFE` · `primary-200` (`blue-200`): `#BFDBFE` (Highlight nhẹ)
- **CMS Quản trị & Báo cáo (`cms/` — White & Executive Teal `teal`)**:
  - `primary-600` (`teal-600`): `#0D9488` · `primary-700` (`teal-700`): `#0F766E` (Menu CMS, nút hành động chính, KPI nhấn, phân tách rõ khỏi POS)
  - `primary-50` (`teal-50`): `#F0FDFA` · `primary-100` (`teal-100`): `#CCFBF1` · `primary-200` (`teal-200`): `#99F6E4` (Highlight nhẹ)
- **Surfaces & Neutral (Dùng chung cả 2 app)**:
  - `brand-dark` / Header / Drawer / Card: `#FFFFFF` (`bg-white`, chữ tối `text-slate-900`, viền `border-slate-200`)
  - `brand-slate` / Bề mặt phụ & Header bảng: `#F8FAFC` (`bg-slate-50`) · `#F1F5F9` (`bg-slate-100`, chữ `text-slate-700`)
- **Semantic Status**:
  - `success`: `#10B981` (Lãi gộp dương, tiền vào, đã hoàn thành, khớp kho)
  - `warning`: `#F59E0B` (Đang kiểm, chênh lệch kho, trả một phần, công nợ)
  - `danger`: `#EF4444` (Hết hàng, hỏng/lỗi, khóa tài khoản, hủy)
  - `info`: `#3B82F6` (Nháp, tra cứu, in PDF)

## 3. Typography & Định dạng hiển thị
- **Font chữ**: `Be Vietnam Pro` (weights 400–800, tối ưu dấu tiếng Việt rõ nét, to & đậm hơn mặc định) cho giao diện; `JetBrains Mono` (weights 500–800) cho **Mã sản phẩm**, **Mã đơn hàng**, **Số điện thoại** và **Số tiền VND**.
- **Scale & Độ đậm**: Tăng kích thước chuẩn (`xs: 13px`, `sm: 15px`, `base: 17px`, `lg: 19px`, `xl: 21px`), nền chữ mặc định `font-medium` (500), tiêu đề & cột bảng `800`, ô nhập `600`, nút bấm `700`.
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
