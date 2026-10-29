# Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)

> **Người thực hiện**: QA/Tester Agent (`tester`)
> **Đối chiếu tài liệu**:
> - Đặc tả yêu cầu: `docs/requirements/he-thong-pos-kho-v1.md` (AC-01..AC-07, BR-01..BR-16)
> - Hợp đồng API: `docs/api-contract.md`
> - Thiết kế UI/UX: `docs/design/pos-inventory-cms-v1.md`
> **Ngày kiểm thử**: 2026-10-28
> **Kết luận tổng thể**: **PASS (ĐẠT 100%)**

---

## 1. Tổng quan Phạm vi & Môi trường Kiểm thử

- **Backend API (`server/`)**: Node.js + Express + TypeScript, bộ kiểm thử tự động tích hợp Vitest + Supertest (`server/tests/api.test.ts`).
- **Web POS & Kho vận (`web/` - Port 3000)**: Next.js 14 + TypeScript + TailwindCSS (5 phân hệ: Bán hàng POS, Kho hàng, Nhập kho 7 bước & Camera OCR, Tra cứu Khách & Xuất PDF, Trả/Đổi hàng).
- **Admin CMS (`cms/` - Port 3001)**: Next.js 14 + TypeScript + TailwindCSS (4 module: Quản lý Kho & Báo cáo Tồn Đầu kỳ/Cuối kỳ, Quản lý Category, Quản lý Đơn hàng & Trả/Đổi, Quản lý Nhân viên & Phân quyền).

---

## 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi)

| Mã TC | Tiêu chí / Quy tắc | Kịch bản kiểm thử | Đầu vào / Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| **TC-01** | **AC-01, BR-03** | Tự động sinh mã sản phẩm từ cặp ngoặc đơn `(...)` cuối cùng trong Tên hàng | Nhập tên hàng: `"Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)"` qua `POST /api/v1/products/generate-code` và trên UI Nhập kho / CMS | Mã sinh ra chính xác là `"AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L"` | Khớp 100% trên cả `server`, `web` và `cms` | **PASS** |
| **TC-02** | **AC-01, BR-03** | Fallback sinh mã sản phẩm khi Tên hàng không có dấu ngoặc đơn `()` | Nhập tên hàng: `"Bình Nước Thể Thao 11Sport 750ml"` | Chuẩn hóa toàn bộ tên hàng thành `"BINH_NUOC_THE_THAO_11SPORT_750ML"` | Trả về đúng `"BINH_NUOC_THE_THAO_11SPORT_750ML"` | **PASS** |
| **TC-03** | **AC-01, BR-03** | Chặn sửa mã sản phẩm (`code`) sau khi đã tạo | Gọi `PATCH /api/v1/products/:id` với `{ "code": "NEW_CODE_123" }`; kiểm tra ô Mã hàng trên UI | API trả về `400 PRODUCT_CODE_IMMUTABLE`; trên UI trường Mã hàng ở chế độ `readOnly` | API trả `400 PRODUCT_CODE_IMMUTABLE`, UI khóa sửa mã | **PASS** |
| **TC-04** | **AC-02, BR-01, BR-02** | Chặn xóa Category đang có sản phẩm gắn kèm | Gọi `DELETE /api/v1/categories/:id` với Category `AO` (`productCount > 0`) | API chặn xóa, trả về `400 CATEGORY_HAS_PRODUCTS`: `"Không thể xóa category đang có sản phẩm; chỉ được ngừng sử dụng"` | Trả về đúng mã lỗi `400 CATEGORY_HAS_PRODUCTS` | **PASS** |
| **TC-05** | **AC-02, BR-02** | Cho phép chuyển Category đang có sản phẩm sang `INACTIVE` (Ngừng sử dụng) | Gọi `PATCH /api/v1/categories/:id` với `{ "status": "INACTIVE" }` | Cập nhật thành công `status = "INACTIVE"`, giữ nguyên dữ liệu lịch sử sản phẩm | Cập nhật thành công `200 OK` | **PASS** |
| **TC-06** | **AC-03, BR-08, BR-09** | Tạo phiếu nhập kho bảng 6 cột & trích xuất Camera OCR (Bước 1, 2, 6) | Tạo phiếu nhập `POST /api/v1/imports` và gọi `POST /api/v1/imports/ocr-preview` | Trả về đúng cấu trúc 6 cột (`STT, MÃ HÀNG, TÊN HÀNG, ĐVT, SỐ LƯỢNG, GHI CHÚ`), tự sinh mã hàng từ `()`, lưu nháp trạng thái `DRAFT` | Hoạt động đúng trên API và `CameraScannerModal` | **PASS** |
| **TC-07** | **AC-03, BR-09** | Chốt danh sách dự kiến (Bước 3) & Quét Tag kiểm tra hàng thực tế (Bước 4) | Gọi `POST /api/v1/imports/:id/finish-listing` -> `POST /api/v1/imports/:id/scan-check` với `actualQuantity = 18` (dự kiến 15) | Chuyển trạng thái sang `CHECKING`, đánh dấu `isChecked = true`, tính chênh lệch `discrepancy = +3` (`Thừa 3 Cái`) | Khớp `matched = true`, `discrepancy = 3` | **PASS** |
| **TC-08** | **AC-03, BR-04, BR-07, BR-09** | Tổng kết tick xác nhận (Bước 5) & Hoàn thành nhập kho (Bước 7) | Phiếu có 2 dòng: Dòng 1 (`isConfirmed = true`, SL thực = 18), Dòng 2 (`isConfirmed = false`). Bấm Hoàn thành (`POST /api/v1/imports/:id/complete`) | Chỉ Dòng 1 được đẩy vào kho, tự động tạo sản phẩm mới với `sellingPrice = 0`, `stock = 18`, ghi `StockMovement` loại `IMPORT`; Dòng 2 không vào kho; khóa phiếu `COMPLETED` | Dòng 1 tạo SP mới giá `0`, tồn `18`; Dòng 2 bỏ qua; phiếu `COMPLETED` | **PASS** |
| **TC-09** | **AC-03, BR-10** | Khóa phiếu nhập kho đã `COMPLETED`, chặn sửa trực tiếp | Gọi `PUT /api/v1/imports/:id` trên phiếu đã `COMPLETED` | API trả về `400 IMPORT_RECEIPT_LOCKED`; giao diện `ImportTab` vô hiệu hóa toàn bộ nút sửa | API trả `400 IMPORT_RECEIPT_LOCKED`, UI khóa chỉnh sửa | **PASS** |
| **TC-10** | **AC-04, BR-04** | Chặn bán sản phẩm chưa có giá bán (`sellingPrice = 0`) hoặc hết tồn kho (`stock <= 0`) | Thêm sản phẩm có `sellingPrice = 0` vào đơn POS (`POST /api/v1/orders`) | API chặn với mã `400 PRODUCT_PRICE_NOT_SET`; trên UI `PosTab` nút chọn bị disable kèm nhãn `"Chưa có giá bán (0 ₫)"` | Chặn đúng ở cả Frontend và Backend | **PASS** |
| **TC-11** | **AC-04, BR-11, BR-12** | Tạo đơn POS thanh toán `CARD` kèm tùy chọn `Có phí 3%` (`hasCardFee = true`) | Mua 3 Áo Polo Xanh (`280,000đ × 3 = 840,000đ`), chọn `CARD` + `hasCardFee = true` | `subtotal = 840,000`, `cardFee = 25,200` (3%), `totalAmount = 865,200`, ghi chú mặc định `"Giá đã bao gồm thuế"`, trừ tồn kho `-3`, ghi `StockMovement` loại `SALE` | Tính đúng `865,200đ`, trừ tồn kho 3 cái, lưu sổ kho `SALE` | **PASS** |
| **TC-12** | **AC-04, BR-12** | Tạo đơn POS thanh toán `CARD` nhưng chọn `Không phí` (`hasCardFee = false`) | Chọn `CARD` + `hasCardFee = false` | `cardFee = 0`, `totalAmount = subtotal` | `cardFee = 0`, `totalAmount` bằng đúng tiền hàng | **PASS** |
| **TC-13** | **AC-04, BR-13** | Xuất & In hóa đơn PDF chuẩn 2 khổ K80 (80mm) và A4 | Mở `InvoicePdfModal` sau khi thanh toán hoặc từ lịch sử đơn hàng, chuyển đổi giữa K80 và A4 | Hiển thị đầy đủ: Thương hiệu 11Sport, mã đơn, ngày giờ, tên & SĐT khách, người bán, bảng hàng hóa, dòng phí thẻ 3%, tổng thanh toán, ghi chú `"Giá đã bao gồm thuế"` | Hiển thị chuẩn 2 khổ K80 (`340px`) và A4 (`794px`), hỗ trợ `window.print()` | **PASS** |
| **TC-14** | **AC-05, BR-11** | Tra cứu khách hàng theo SĐT trên POS và màn hình Khách hàng | Nhập SĐT `"0988777666"` hoặc `"0901234567"` vào `GET /api/v1/customers/lookup?phone=...` | Tự động trả về hồ sơ khách hàng (`name`, `phone`, `totalSpent`), danh sách lịch sử đơn hàng + phiếu trả/đổi và nút in lại PDF | Tự điền tên khách quen và hiển thị lịch sử đơn kèm nút PDF | **PASS** |
| **TC-15** | **AC-06, BR-14, BR-15, BR-16** | Đổi hàng kết hợp trả hàng `GOOD` (còn bán được) và `DAMAGED` (hỏng/lỗi) | Đơn gốc mua 3 áo (`280,000đ/cái`, có phí thẻ 3%). Trả 1 áo `GOOD` + 1 áo `DAMAGED` (`returnTotal = 560,000đ`), đổi lấy 1 đôi giày `850,000đ` | Không hoàn phí thẻ 3%; `netDifference = 850,000 - 560,000 = +290,000đ` (khách trả thêm); tồn kho áo chỉ `+1` (cho hàng `GOOD`), tồn kho giày `-1`; đơn gốc chuyển sang `PARTIALLY_RETURNED` | Tính đúng chênh lệch `+290,000đ`, tồn kho áo `+1`, giày `-1`, đơn `PARTIALLY_RETURNED` | **PASS** |
| **TC-16** | **AC-06, BR-14, BR-16** | Chặn trả vượt số lượng đã mua & Cập nhật `FULLY_RETURNED` khi trả hết | 1. Thử trả 5 sản phẩm khi chỉ mua 1 -> Kiểm tra lỗi.<br>2. Trả đúng 1/1 sản phẩm đã mua. | 1. Chặn `400 EXCEED_RETURNABLE_QUANTITY`.<br>2. Hoàn tiền đúng giá gốc, đơn gốc chuyển sang `FULLY_RETURNED`. | 1. Trả lỗi `400 EXCEED_RETURNABLE_QUANTITY`.<br>2. Đơn chuyển sang `FULLY_RETURNED`. | **PASS** |
| **TC-17** | **AC-07, BR-05, BR-06, BR-07** | Báo cáo Tồn kho theo kỳ (Tồn đầu kỳ / Cuối kỳ) & Lập Phiếu điều chỉnh kho trên CMS | 1. Thử sửa tay `stock` qua `PATCH /products/:id`.<br>2. Lập phiếu điều chỉnh `POST /inventory/adjustments` (`quantityChange: -2`).<br>3. Xem `GET /inventory/report`. | 1. Chặn `400 STOCK_DIRECT_EDIT_FORBIDDEN`.<br>2. Giảm tồn kho `-2`, sinh `StockMovement` loại `ADJUSTMENT`.<br>3. Mọi mặt hàng thỏa mãn `closingStock = openingStock + importedQty - soldQty + adjustedAndReturnedQty`. | Tất cả công thức tồn đầu kỳ / cuối kỳ khớp tuyệt đối 100% với tồn thực tế | **PASS** |
| **TC-18** | **RBAC (Mục 2)** | Quản lý nhân viên, phân quyền (`SALES`, `WAREHOUSE`, `ADMIN`) & Khóa tài khoản | Tạo nhân viên mới, đổi role, khóa tài khoản (`status = LOCKED`) và thử đăng nhập lại | Khi `status = LOCKED`, `POST /api/v1/auth/login` trả về `403 ACCOUNT_LOCKED`; mật khẩu được băm SHA-256 có salt, không lộ `passwordHash` qua API | Hoạt động đúng và bảo mật | **PASS** |

---

## 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check

1. **Integration Tests (`server`)**:
   - Lệnh thực thi: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"; cd "c:\11Sport IT\server"; npm test`
   - Kết quả: **8/8 test suites PASS** (100% đạt trong `107ms`), bao phủ toàn bộ AC-01..AC-07 và các trường hợp biên BR-01..BR-16.
2. **TypeScript Type-check (`server`, `web`, `cms`)**:
   - Lệnh thực thi: `npx tsc --noEmit` trên cả 3 thư mục `server/`, `web/`, `cms/`.
   - Kết quả: **0 lỗi biên dịch (Exit code 0)**.
3. **Kiểm tra Liên thông API giữa Frontend (`web`, `cms`) và Backend (`server`)**:
   - Đã rà soát và đồng bộ thông tin đăng nhập nhanh (Quick Role Switcher) và cấu trúc đọc dữ liệu trả về của endpoint Hoàn thành nhập kho (`/imports/:id/complete`) & Trả/Đổi hàng (`/returns`).

---

## 4. Kết luận Nghiệm thu

- **Tổng số Test Cases thực hiện**: **18 / 18 PASS (100%)**
- **Số lỗi Chặn (Blocker) / Nghiêm trọng (Critical) còn mở**: **0**
- **Đánh giá nghiệm thu**: **PASS** — Hệ thống đủ điều kiện bàn giao nghiệm thu v1.0.
