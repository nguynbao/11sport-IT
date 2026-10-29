# Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

> **Người lập**: UI/UX Designer Agent (`11sport-designer`)
> **Đầu vào**: `docs/requirements/he-thong-pos-kho-v1.md`

---

## Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)

### 1. Thanh điều hướng & Chuyển vai trò nhanh
- Hiển thị nhân viên đang đăng nhập (`Tên nhân viên` + Badge `Vai trò`: Nhân viên bán hàng / Thủ kho / Quản lý).
- Các phân hệ chính trên `web/`:
  1. **Bán hàng (POS)**: Tạo đơn, chọn hàng, tính phí thẻ 3%, xuất hóa đơn PDF.
  2. **Kho hàng**: Xem tổng sản phẩm, tổng tồn kho, lọc theo Category, tìm theo mã/tên hàng.
  3. **Nhập kho (7 bước & Camera)**: Danh sách phiếu nhập, tạo phiếu 6 cột, nút "Kiểm hàng" (Camera OCR), nút "Hoàn tất", bước kiểm thực tế (quét tag + ô tìm kiếm), Tổng kết tick xác nhận, Lưu nháp, Hoàn thành.
  4. **Khách hàng & Hóa đơn PDF**: Tra cứu theo SĐT, xem lịch sử đơn, mở bản in PDF (K80 / A4).
  5. **Trả / Đổi hàng**: Nhập mã đơn gốc, kiểm tra số lượng đã mua/đã trả, chọn hàng trả (kèm tình trạng Còn bán được / Hỏng) và hàng đổi mới, tự tính chênh lệch và xác nhận.

### 2. Chi tiết luồng màn hình Nhập kho (`web/`)
- **Bước 1 & 2 (Soạn phiếu 6 cột - Trạng thái `DRAFT`)**:
  - Bảng 6 cột: `STT | MÃ HÀNG | TÊN HÀNG | ĐVT | SỐ LƯỢNG | GHI CHÚ`.
  - Khi gõ `TÊN HÀNG` có chứa `(...)`, cột `MÃ HÀNG` tự động điền theo quy tắc IN HOA KHÔNG DẤU GẠCH CHÂN.
  - Nút **"📷 Kiểm hàng (Camera OCR)"**: Chụp từ camera hoặc tải ảnh phiếu nhập -> tự động điền các dòng vào bảng 6 cột, cho phép sửa/thêm/xóa dòng.
  - Nút **"💾 Lưu nháp"** và nút **"➡️ Hoàn tất (Chuyển sang Kiểm thực tế)"**.
- **Bước 3 & 4 (Kiểm tra hàng thực tế - Trạng thái `CHECKING`)**:
  - Có ô **Tìm kiếm hàng nhanh** (theo mã hoặc tên) và nút **"📷 Quét Tag kiểm tra"** trên từng dòng hoặc quét chung:
    - Nếu khớp mã/tên trong phiếu: đánh dấu `Đã kiểm`, điền số lượng thực nhận.
    - Nếu không khớp: hiển thị cảnh báo, cho phép thêm vào phiếu hoặc ghi chú chênh lệch.
- **Bước 5, 6, 7 (Tổng kết & Hoàn thành - Trạng thái `COMPLETED`)**:
  - Hiển thị thanh thống kê: `Số dòng đã kiểm / Tổng số dòng`, số dòng `Khớp / Thiếu / Thừa`.
  - Checkbox tick xác nhận từng dòng (hoặc chọn tất cả dòng đã kiểm).
  - Nút **"✅ Hoàn thành nhập kho"**: đẩy các dòng đã tick vào kho, tự tạo sản phẩm mới nếu chưa có, ghi sổ kho và khóa phiếu.

---

## Phần B: Giao diện `cms/` (Quản trị - Port `3001`)

### Các Module chính
1. **Tổng quan & Quản lý Kho (`Inventory & Stock Ledger`)**:
   - Thẻ KPI: Tổng mặt hàng, Tổng tồn kho, Số phiếu nhập hoàn thành, Báo cáo **Tồn đầu kỳ / Nhập trong kỳ / Bán trong kỳ / Điều chỉnh / Tồn cuối kỳ**.
   - Tab **Danh sách sản phẩm & Giá bán**: Cập nhật giá bán lẻ (`sellingPrice`) cho các mặt hàng mới nhập kho (đang có giá `0`), lọc theo Category.
   - Tab **Sổ kho (Stock Movements)**: Xem lịch sử mọi biến động (`+`/`-`), người thực hiện, chứng từ tham chiếu.
   - Tab **Phiếu điều chỉnh kho**: Lập phiếu điều chỉnh tăng/giảm tồn kho kèm lý do (vì phiếu nhập đã hoàn thành không được sửa trực tiếp).
2. **Quản lý Category**:
   - Thêm mới, sửa tên, chuyển trạng thái `Đang dùng (ACTIVE)` / `Ngừng sử dụng (INACTIVE)`.
   - Nút xóa tự động khóa/chặn nếu Category đang có sản phẩm.
3. **Quản lý Đơn hàng & Trả/Đổi**:
   - Tìm kiếm theo mã đơn, SĐT khách, lọc theo trạng thái (`Đã bán`, `Đã trả một phần`, `Đã trả toàn bộ`), phương thức thanh toán.
   - Xem chi tiết đơn, danh sách phiếu trả/đổi gắn kèm, xuất/in hóa đơn PDF (K80 / A4).
4. **Quản lý Nhân viên**:
   - Thêm, sửa thông tin, phân quyền (`SALES`, `WAREHOUSE`, `ADMIN`), khóa/mở khóa tài khoản.
