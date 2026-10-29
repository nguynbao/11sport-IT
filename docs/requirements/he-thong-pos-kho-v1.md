# Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)

> **Trạng thái**: Đã chốt yêu cầu (Approved)
> **Người lập**: BA Agent (`11sport-ba`) · **Điều phối**: PM Agent (`11sport-pm`)
> **Tech Stack**:
> - **`server/`**: Node.js + Express + TypeScript + MongoDB (Mongoose)
> - **`web/` (POS & Kho)**: Next.js (React + TypeScript) + TailwindCSS
> - **`cms/` (Quản trị)**: Next.js (React + TypeScript) + TailwindCSS

---

## 1. Bối cảnh & Mục tiêu kinh doanh
Hệ thống phục vụ cửa hàng **11Sport** quản lý toàn bộ vòng đời hàng hóa: nhập hàng từ nhà cung cấp, kiểm hàng (camera OCR / quét mã / tìm kiếm), lưu kho (sổ kho kế toán), bán hàng tại quầy (POS), xuất/in hóa đơn PDF (K80 & A4), tra cứu khách hàng và xử lý trả/đổi hàng.

### Phạm vi hệ thống (3 thành phần)
- **`server/` (Port `4000`)**: REST API (`/api/v1`), cơ sở dữ liệu MongoDB, xử lý toàn bộ nghiệp vụ kho, nhập kho, bán hàng, trả/đổi, khách hàng, nhân viên, danh mục.
- **`web/` (Port `3000` - POS & Kho)**: Giao diện tác nghiệp cho Nhân viên bán hàng và Thủ kho.
- **`cms/` (Port `3001` - Quản trị)**: Giao diện quản trị cho Quản lý/Admin (nhân viên, đơn hàng, kho, category).

---

## 2. Vai trò người dùng & Phân quyền (RBAC)

| Vai trò (`role`) | Hệ thống sử dụng | Quyền hạn chi tiết |
| --- | --- | --- |
| **Nhân viên bán hàng (`SALES`)** | `web/` (POS) | Tạo đơn bán hàng theo đúng giá niêm yết (không tự sửa giá), tra cứu khách theo SĐT, in/xuất PDF hóa đơn (K80/A4), xử lý trả/đổi hàng tại quầy (lưu lịch sử người thực hiện), xem tồn kho |
| **Thủ kho (`WAREHOUSE`)** | `web/` (Kho) | Tạo phiếu nhập kho, dùng camera kiểm hàng (OCR bảng hàng & quét tag), xác nhận nhập kho, lưu nháp phiếu nhập, tạo nhanh sản phẩm mới khi nhập, xem tồn kho |
| **Quản lý / Admin (`ADMIN`)** | `cms/` & `web/` | Toàn quyền trên CMS và Web: quản lý nhân viên (thêm/sửa/khóa/phân quyền), quản lý category, quản lý sản phẩm & cập nhật giá bán, xem/lọc đơn hàng & phiếu trả/đổi, xem sổ kho & lập phiếu điều chỉnh kho |

---

## 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)

### 3.1 Danh mục (Category) & Sản phẩm (Product)
- **BR-01 (Thuộc tính Category)**: Gồm `code` (mã category, in hoa duy nhất), `name` (tên category), `status` (`ACTIVE`: đang dùng / `INACTIVE`: ngừng sử dụng). Mỗi sản phẩm thuộc đúng 1 category.
- **BR-02 (Chặn xóa Category)**: Không cho phép xóa category đang có sản phẩm; chỉ cho phép chuyển trạng thái sang `INACTIVE` (ngừng sử dụng).
- **BR-03 (Công thức tự sinh Mã sản phẩm từ Tên hàng)**:
  - Mã sản phẩm (`code`) tự sinh từ cột **Tên hàng hóa**, cụ thể: trong tên hàng luôn có cặp ngoặc đơn `(...)`, hệ thống trích xuất nội dung bên trong cặp `(...)` cuối cùng, chuyển thành **IN HOA, KHÔNG DẤU tiếng Việt, thay khoảng trắng/ký tự đặc biệt bằng dấu gạch chân `_`**.
  - **Ví dụ chuẩn**:
    - Tên hàng: `Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)`
    - Nội dung trong `()`: `Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L`
    - Mã sản phẩm tự sinh: `AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L`
  - *Fallback*: Nếu tên hàng không chứa `()`, hệ thống chuẩn hóa toàn bộ chuỗi tên hàng theo quy tắc IN HOA, KHÔNG DẤU, GẠCH CHÂN `_`.
  - Mã sản phẩm là **duy nhất** và **không được sửa** sau khi tạo.
- **BR-04 (Giá bán & Điều kiện bán)**:
  - Khi tạo sản phẩm mới trong luồng nhập kho, `sellingPrice` (giá bán) không bắt buộc, mặc định = `0`.
  - Admin/Quản lý cập nhật giá bán tại CMS (hoặc màn hình Kho).
  - Sản phẩm bắt buộc phải có `sellingPrice > 0` và `stock > 0` mới được phép thêm vào đơn bán hàng.

### 3.2 Kế toán Kho & Sổ kho (Stock Movement)
- **BR-05 (Không sửa tay tồn kho)**: Trường `stock` (tồn kho hiện tại) của sản phẩm do hệ thống tự tính từ **Sổ kho (`StockMovement`)**, không cho phép nhập tay trực tiếp.
- **BR-06 (Công thức tồn kho kế toán)**:
  $$\text{Tồn cuối kỳ} = \text{Tồn đầu kỳ} + \text{Nhập trong kỳ} - \text{Bán trong kỳ} \pm \text{Điều chỉnh trả/đổi/kiểm kê}$$
  Trong đó **Tồn đầu kỳ** của kỳ này chính là **Tồn cuối kỳ** của kỳ trước (hỗ trợ lọc theo khoảng thời gian Từ ngày – Đến ngày trên CMS).
- **BR-07 (Sổ kho - Stock Movement)**: Mọi biến động tồn kho bắt buộc sinh bản ghi `StockMovement` gồm:
  - `type`: `IMPORT` (Nhập kho) | `SALE` (Bán hàng) | `RETURN` (Trả hàng) | `EXCHANGE_IN` (Nhận hàng đổi về) | `EXCHANGE_OUT` (Xuất hàng đổi mới) | `ADJUSTMENT` (Điều chỉnh kho)
  - `productId`, `productCode`, `productName`
  - `quantityChange` (số nguyên dương `+` hoặc âm `-`), `balanceAfter` (tồn sau giao dịch)
  - `referenceType`, `referenceCode` (mã phiếu nhập / mã đơn hàng / mã phiếu trả đổi / mã phiếu điều chỉnh)
  - `performedBy` (nhân viên thực hiện), `note`, `createdAt`.

### 3.3 Nhập kho (Import Receipt)
- **BR-08 (Cấu trúc bảng 6 cột)**:
  `STT` | `MÃ HÀNG` | `TÊN HÀNG` | `ĐVT` | `SỐ LƯỢNG` | `GHI CHÚ`
- **BR-09 (Quy trình 7 bước & 3 trạng thái)**:
  - Trạng thái phiếu nhập: `DRAFT` (Nháp) → `CHECKING` (Đang kiểm) → `COMPLETED` (Đã hoàn thành).
  - **Bước 1 (Tạo phiếu)** & **Bước 2 (Nút "Kiểm hàng" bằng Camera)**: Mở camera chụp/tải ảnh chứng từ bảng hàng (OCR trích xuất tự động vào 6 cột) hoặc nhập/sửa tay từng ô, thêm/xóa dòng. Mã hàng tự động sinh từ `()` trong cột Tên hàng theo `BR-03`.
  - **Bước 3 (Nút "Hoàn tất" danh sách dự kiến)**: Chốt danh sách hàng dự kiến (`status = CHECKING`) để chuyển sang bước kiểm tra thực tế.
  - **Bước 4 (Kiểm tra hàng thực tế)**: Với mỗi mặt hàng thực nhận, bấm kiểm tra để mở camera quét mã/tên hàng trên tag (hoặc dùng ô tìm kiếm nhanh):
    - Khớp dòng trong phiếu: ghi nhận đã kiểm (`isChecked = true`), lưu số lượng thực nhận (`actualQuantity`).
    - Không khớp / chưa có trong phiếu: cảnh báo, cho phép thêm dòng mới / nhập tay hoặc ghi chú chênh lệch (`discrepancyNote`).
  - **Bước 5 (Tổng kết)**: Tick xác nhận (`isConfirmed = true`) các dòng đã kiểm xong. Hiển thị tổng số dòng đã kiểm / tổng số dòng và chênh lệch (`actualQuantity - expectedQuantity`: thiếu/thừa/khớp).
  - **Bước 6 (Lưu nháp)**: Lưu lại ở bất kỳ bước nào trước khi hoàn thành.
  - **Bước 7 (Hoàn thành)**: Chỉ các dòng **đã được tick xác nhận (`isConfirmed = true`)** mới được đẩy vào kho (nếu mã hàng chưa tồn tại trong danh mục sản phẩm thì tự động tạo sản phẩm mới với category chọn/mặc định và `sellingPrice = 0`, cộng tồn kho theo `actualQuantity`, ghi `StockMovement`). Khóa phiếu vĩnh viễn (`status = COMPLETED`).
- **BR-10 (Khóa phiếu nhập)**: Phiếu nhập đã `COMPLETED` không được sửa trực tiếp; nếu sai phải lập **Phiếu điều chỉnh kho** tại CMS.

### 3.4 Bán hàng (POS Order) & Xuất PDF
- **BR-11 (Khách hàng & Đơn hàng)**:
  - Nhập `customerPhone` (bắt buộc) làm khóa tra cứu khách: nếu SĐT đã tồn tại thì tự động điền `customerName` và hiển thị lịch sử mua hàng; nếu khách mới thì nhập `customerName` (bắt buộc) và tự lưu hồ sơ khách hàng.
  - Ghi chú mặc định trên đơn và hóa đơn: `"Giá đã bao gồm thuế"`.
- **BR-12 (Tính tiền & Phí quẹt thẻ 3%)**:
  - `Thành tiền dòng (lineTotal) = Đơn giá (unitPrice) × Số lượng (quantity)`
  - `Tiền hàng (subtotal) = Tổng các lineTotal`
  - Phương thức thanh toán (`paymentMethod`):
    - `CASH` (Tiền mặt): `cardFee = 0`
    - `BANKING` (Chuyển khoản): `cardFee = 0`
    - `CARD` (Thẻ): có 2 tùy chọn `hasCardFee = true` (phí 3%) hoặc `hasCardFee = false` (không phí).
      - Khi `hasCardFee = true`: `cardFee = Math.round(subtotal * 0.03)` (khách chịu phí, cộng vào tổng thanh toán và hiển thị riêng 1 dòng trên hóa đơn).
  - `Tổng thanh toán (totalAmount) = subtotal + cardFee`.
- **BR-13 (Xuất hóa đơn PDF)**: Hỗ trợ xuất và in hóa đơn PDF theo cả 2 khổ: **Khổ bill nhiệt K80 (80mm)** và **Khổ A4**, hiển thị đầy đủ: thông tin cửa hàng 11Sport, mã đơn, thời gian, khách hàng (tên, SĐT), người bán, bảng chi tiết hàng hóa, tiền hàng, dòng phí thẻ 3% (nếu có), tổng thanh toán, phương thức thanh toán, ghi chú `"Giá đã bao gồm thuế"`.

### 3.5 Trả / Đổi hàng (Return & Exchange)
- **BR-14 (Kiểm tra đơn gốc & Số lượng trả hợp lệ)**:
  - Nhập mã đơn hàng gốc cần trả/đổi.
  - Số lượng trả tối đa của mỗi dòng hàng = `Số lượng mua ban đầu (quantity) − Số lượng đã trả các lần trước (returnedQuantity)`.
- **BR-15 (Tình trạng hàng trả về & Tồn kho)**:
  - Mỗi dòng hàng trả về có trạng thái tình trạng `condition`:
    - `GOOD` (Còn bán được): Cộng lại vào tồn kho sản phẩm (`+quantity`) và ghi sổ kho.
    - `DAMAGED` (Hỏng/Lỗi): Không cộng vào tồn kho bán hàng (ghi nhận lịch sử trả hàng lỗi).
- **BR-16 (Tính tiền thanh toán lại khi Trả / Đổi)**:
  - Tính trên đơn giá gốc của sản phẩm (không hoàn phí thẻ 3%):
  - **Trả hàng**: `Số tiền hoàn khách = Tổng thành tiền các sản phẩm trả` (`refundAmount`).
  - **Đổi hàng**: `Chênh lệch (netDifference) = Tổng thành tiền hàng đổi mới − Tổng thành tiền hàng trả lại`.
    - Nếu `netDifference > 0`: Khách trả thêm.
    - Nếu `netDifference < 0`: Cửa hàng hoàn lại cho khách `|netDifference|`.
  - Cập nhật trạng thái đơn gốc: `PAID` (Đã bán) → `PARTIALLY_RETURNED` (Đã trả/đổi một phần) hoặc `FULLY_RETURNED` (Đã trả toàn bộ).

---

## 4. Tiêu chí Nghiệm thu (Acceptance Criteria)

- **AC-01 (Sinh mã sản phẩm từ dấu ngoặc đơn)**:
  *Given* Tên hàng nhập vào là `"Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)"`,
  *When* hệ thống sinh mã sản phẩm,
  *Then* mã sản phẩm phải là `"AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L"` và không cho phép sửa mã sau khi tạo.
- **AC-02 (Quản lý Category)**:
  *Given* Category đang có ít nhất 1 sản phẩm gắn kèm,
  *When* Admin gọi thao tác xóa hoặc ngừng sử dụng,
  *Then* hệ thống chặn xóa vĩnh viễn và chỉ cho phép chuyển trạng thái sang `INACTIVE`.
- **AC-03 (Luồng Nhập kho 7 bước & Sổ kho)**:
  *Given* Thủ kho tạo phiếu nhập, quét/nhập bảng 6 cột, bấm Hoàn tất sang bước Kiểm thực tế, kiểm và tick xác nhận các dòng hàng rồi bấm Hoàn thành,
  *Then* chỉ các dòng được tick mới cộng số lượng thực nhận vào tồn kho, tự tạo sản phẩm mới (với `sellingPrice = 0`) nếu chưa có, ghi bản ghi `StockMovement` loại `IMPORT` và khóa phiếu nhập (`COMPLETED`).
- **AC-04 (Bán hàng POS & Phí thẻ 3%)**:
  *Given* Khách hàng mua các sản phẩm có `sellingPrice > 0` và `stock >= số lượng mua`, chọn phương thức `CARD` kèm tùy chọn `Có phí 3%`,
  *When* Nhân viên xác nhận đơn,
  *Then* hệ thống tính đúng `cardFee = 3% × tiền hàng`, cộng vào `totalAmount`, trừ tồn kho, ghi `StockMovement` loại `SALE` và cho phép in hóa đơn PDF khổ K80/A4 có dòng phí thẻ riêng.
- **AC-05 (Tra cứu SĐT khách hàng)**:
  *Given* Khách hàng đã từng mua hàng tại 11Sport,
  *When* Nhân viên nhập SĐT tại màn hình POS hoặc màn hình Tra cứu khách hàng,
  *Then* hệ thống tự điền tên khách và hiển thị toàn bộ lịch sử đơn hàng kèm nút xuất lại PDF.
- **AC-06 (Trả/Đổi hàng & Cập nhật tồn kho)**:
  *Given* Đơn hàng gốc hợp lệ, nhân viên chọn sản phẩm trả lại (với tình trạng `GOOD` hoặc `DAMAGED`) và sản phẩm đổi mới (nếu có),
  *When* xác nhận phiếu trả/đổi,
  *Then* hệ thống tính đúng tiền hoàn/thu thêm (không hoàn phí thẻ 3%), chỉ cộng lại tồn kho cho hàng trả có tình trạng `GOOD`, trừ tồn kho hàng đổi mới, và cập nhật trạng thái đơn gốc (`PARTIALLY_RETURNED` / `FULLY_RETURNED`).
- **AC-07 (Báo cáo Tồn đầu kỳ / Cuối kỳ & Điều chỉnh kho trên CMS)**:
  *Given* Quản lý đăng nhập CMS Quản lý kho,
  *When* xem báo cáo tồn kho theo kỳ hoặc tạo Phiếu điều chỉnh kho,
  *Then* hệ thống hiển thị đúng `Tồn cuối kỳ = Tồn đầu kỳ + Nhập − Bán ± Điều chỉnh` và mọi điều chỉnh đều lưu vết trong Sổ kho.
