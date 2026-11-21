# Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

Ngày chốt: 2026-11-17 · Người chốt: Chủ dự án · Phạm vi: `server/`, `cms/`, `web/`

## 1. Vấn đề
- Brand là ô chữ tự do + danh sách `KNOWN_BRANDS` viết cứng → sai/trùng hãng, gán `NN` khi gặp hãng lạ.
- Mã gốc hiện = chữ đầu Category + Hãng + 6 số ngẫu nhiên/hash; khi admin thêm sản phẩm mới, hệ thống tự "bắt" về mã cũ (khớp mờ theo tên) → không tạo được mã mới đúng ý.
- Giá chỉ ở cấp sản phẩm gốc → không thể đặt giá khác nhau cho màu/size khác nhau.

## 2. Quy tắc đã chốt
| # | Quy tắc |
|---|---|
| R1 | **Mã gốc** = `CateCode` + `BrandCode` + `VersionCode` (viết liền, IN HOA, không dấu). VD: `G` + `ASC` + `SSFF4` = `GASCSSFF4` |
| R2 | **Mã con (SKU/barcode)** = Mã gốc + `ColorCode` + `SizeCode`. VD: `GASCSSFF4DO40`. Không màu/size thì bỏ phần đó |
| R3 | Mã ngắn do admin đặt: Cate **1–3** ký tự, Brand **2–4**, Version **≤ 6**, Màu **2–3** (gợi ý tự động, sửa được), Size giữ nguyên dạng viết liền. Chỉ `A-Z0-9` |
| R4 | Một bộ (Category, Brand, Version) = **duy nhất 1 sản phẩm gốc** (unique). Một bộ (Màu, Size) trong sản phẩm = duy nhất 1 biến thể |
| R5 | **Version = tên mẫu** (VD "Pro 2024", "X-Speed"), lưu `versionName` + `versionCode` |
| R6 | **Brand là danh mục quản lý riêng** (code, name, status, aliases để nhận diện khi import), **gắn với 1 hoặc nhiều Category**. Khi chọn Category chỉ hiển thị Brand thuộc Category đó. Có Brand hệ thống `NN` (không hãng) dùng được cho mọi Category |
| R7 | Tab CMS "Quản lý Category (Danh mục)" đổi thành **"Danh mục & Thương hiệu"** với 2 tab con: Danh mục / Thương hiệu |
| R8 | **Giá theo biến thể**: mỗi biến thể có `sellingPrice`, `costPrice` riêng (tuỳ chọn). Trống/0 → dùng giá sản phẩm gốc. POS, đơn hàng, đổi trả, nhập kho (cập nhật giá vốn) dùng giá biến thể |
| R9 | Thêm sản phẩm mới: **chọn** Category → Brand → nhập Version → hệ thống sinh mã theo R1, KHÔNG tự khớp về mã cũ. Nếu trùng bộ R4 → báo lỗi `PRODUCT_DUPLICATE` kèm sản phẩm đã có (admin chủ động chọn "thêm biến thể vào sản phẩm này") |
| R10 | Trùng mã sinh ra (2 version khác nhau rút gọn ra cùng code) → báo lỗi, admin sửa VersionCode |
| R11 | Không xoá Brand đang có sản phẩm, chỉ ngừng sử dụng (giống Category) |

## 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL)
- Đổi mã **tại chỗ, giữ nguyên `_id`** sản phẩm. Nếu nhiều sản phẩm cũ ra cùng mã mới → **gộp** (cộng tồn từng tầng theo biến thể, trỏ lại `productId` ở các bảng liên quan về sản phẩm giữ lại).
- Lưu mã cũ vào `legacyCode` (sản phẩm) và `legacyVariantCode` (biến thể) để tra cứu/quét tem cũ.
- Cập nhật toàn bộ bảng có tham chiếu: `orders`, `stockmovements`, `importreceipts`, `returnexchanges`, `promotions`, `shifthandovers` (+ bất kỳ bảng nào khác chứa productCode/variantCode/barcode). Thêm `legacyCode` ở dòng tham chiếu.
- Quy trình 2 bước:
  1. **Dry-run**: tự tách Brand/Version từ tên, sinh mã đề xuất → xuất file Excel cho chủ dự án duyệt/sửa. Sản phẩm không hãng → Brand `NN`. Không ghi DB.
  2. **Apply**: đọc file Excel đã duyệt → backup DB local → chạy chuyển đổi → báo cáo đối soát (tổng tồn trước/sau bằng nhau, không còn mã cũ mồ côi).
- Script **từ chối chạy** nếu `MONGODB_URI` không trỏ `127.0.0.1`/`localhost`. Tuyệt đối không chạm production.

## 4. Tiêu chí nghiệm thu
- AC1: CRUD Brand trên CMS, lọc Brand theo Category; không xoá được Brand có sản phẩm.
- AC2: Tạo sản phẩm Giày/Asics/"Solution Speed FF4"/SSFF4 + Đỏ/40 → mã gốc `GASCSSFF4`, mã con `GASCSSFF4DO40`.
- AC3: Tạo lại cùng bộ Category+Brand+Version → lỗi trùng, không sinh mã cũ.
- AC4: Biến thể Đỏ giá 1.200.000, Xanh giá 1.350.000 → POS quét từng mã ra đúng giá; biến thể không có giá dùng giá gốc.
- AC5: Sau migrate local: tổng tồn kho (T1, T2) không đổi; mọi bảng không còn productCode/variantCode cũ (trừ trường legacy); quét tem cũ vẫn tìm ra sản phẩm.
- AC6: Toàn bộ test server PASS, build `cms`, `web` PASS.
