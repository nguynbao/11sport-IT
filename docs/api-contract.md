# Hợp đồng API (API Contract) - 11 Sport (v1.0)

> Mọi thay đổi chạm API giữa `server/`, `web/`, và `cms/` bắt buộc phải cập nhật tài liệu này TRƯỚC khi code.

## 1. Quy ước chung
- **Base URL**: `http://localhost:4000/api/v1`
- **Định dạng tiền tệ**: Số nguyên (`integer`), đơn vị `VND` (không dùng số thực).
- **Header xác thực / ngữ cảnh người dùng**:
  - `Authorization: Bearer <token>` (hoặc `x-user-id` trong môi trường nội bộ/demo POS)
- **Định dạng phản hồi thành công**:
  ```json
  {
    "data": {},
    "meta": {}
  }
  ```
- **Định dạng phản hồi lỗi chuẩn**:
  ```json
  {
    "code": "ERROR_CODE",
    "message": "Thông điệp mô tả lỗi tiếng Việt rõ ràng",
    "fields": {}
  }
  ```

---

## 2. Danh sách Endpoints

### 2.0 Kiểm tra trạng thái hệ thống (`/health`)
- `GET /api/v1/health`
  - Response: `{ "data": { "status": "ok", "service": "11sport-server", "dbMode": "mongodb | memory", "timestamp": "..." } }`

### 2.1 Xác thực & Nhân viên (`/auth`, `/staff`)
- `POST /api/v1/auth/login`
  - Body: `{ "username": "string", "password": "string" }`
  - Response: `{ "data": { "token": "string", "user": { "_id": "...", "code": "NV001", "username": "sales1", "fullName": "Nguyễn Văn Bán", "role": "ADMIN | HR | ACCOUNTANT | MARKETING | SALES", "department": "OFFICE | SALES", "status": "ACTIVE | LOCKED", "mustChangePassword": false } } }`
  - **Bảo mật Seed**: Không bao giờ tự động seed tài khoản đặc quyền mẫu (`hr`, `hr1`, `accountant1`, `marketing1`, `warehouse1`, `sales1`) bằng mật khẩu công khai (`123456`) trên DB thật hoặc môi trường `production`. Tài khoản mẫu chỉ được tạo trong môi trường memory/test (`FORCE_MEMORY_DB=true` / `dbMode === "memory"`) ngoài production; nếu khởi tạo `admin` lần đầu trên DB thật mà không cấu hình `INITIAL_ADMIN_PASSWORD`, hệ thống sinh mật khẩu ngẫu nhiên và bật `mustChangePassword: true`.
- `POST /api/v1/auth/change-password` *(v2.3)*
  - Đổi mật khẩu của tài khoản đang đăng nhập (đồng thời xóa cờ `mustChangePassword: false`).
  - Body: `{ "currentPassword": "string", "newPassword": "string" }`
  - Quy tắc: Kiểm tra `currentPassword` khớp mật khẩu hiện tại (sai → `400 INVALID_CURRENT_PASSWORD`), `newPassword` tối thiểu 4 ký tự (`400 VALIDATION_ERROR`).
  - Response: `{ "data": { "changed": true, "username": "admin", "fullName": "Quản Trị Viên 11Sport" }, "meta": {} }`
- `GET /api/v1/staff` — Danh sách nhân viên (CMS: role `ADMIN` hoặc `HR`; nhân viên đăng nhập xem thông tin cá nhân của mình). Hỗ trợ query lọc & sắp xếp: `?role=`, `?department=`, `?contractType=`, `?status=`, `?search=`, `?sortBy=code|fullName|baseSalary|allowance|bonus|insurance|createdAt`, `?sortOrder=asc|desc`.
- `POST /api/v1/staff` — Tạo nhân viên mới (`username`, `password`, `fullName`, `phone`, `email`, `companyEmail`, `role`, `department`, `contractType`, `citizenId`, `contractStartDate`, `contractEndDate`, `contractFileUrl`, `contractFileName`, `baseSalary`, `allowance`, `bonus`, `insurance`):
  - `ADMIN` tạo tài khoản nhanh với `username`, `password`, `role` (được cấp mọi role kể cả `ADMIN`; nếu bỏ trống `fullName` hệ thống tự lấy theo `username`).
  - `HR` tạo tài khoản kèm hồ sơ nhân sự chi tiết, tải file hợp đồng (`contractFileUrl`, `contractFileName`) và thiết lập thông tin lương/chế độ (`baseSalary`, `allowance`, `bonus`, `insurance`), nhưng **không được phép** cấp `role: "ADMIN"` (trả `403 FORBIDDEN`).
  - **Loại hợp đồng `contractType` & Cơ chế Thử việc -> Chính thức**: `INTERN` (Thực tập) | `PROBATION` (Thử việc) | `FULLTIME` (Chính thức). Giá trị cũ `PARTTIME` vẫn được đọc để tương thích nhưng không còn cho chọn mới.
    - `HR` tạo tài khoản **bắt buộc chọn** loại hợp đồng (không có mặc định trên giao diện). Giá trị khác danh sách → `400 INVALID_CONTRACT_TYPE`.
    - Nếu không truyền (VD `ADMIN` tạo nhanh), server mặc định **`PROBATION` (Thử việc)** — không còn mặc định Chính thức.
    - **Thử việc tối đa 2 tháng (`probationMonths`: `0 | 1 | 2`, mặc định `2` tháng cho `PROBATION`, có thể ký chính thức sau `1` tháng)**: Mỗi tháng thử việc tích lũy **1 ngày phép có lương**. Khi chuyển từ `PROBATION` lên `FULLTIME` (`PATCH /api/v1/staff/:id`), nhân viên được cộng số ngày phép tương đương với số tháng thử việc (`1` hoặc `2` ngày) vào quỹ phép chính thức, và mỗi tháng chính thức có thêm **1 ngày phép** (được để dành & cộng dồn).
- `PATCH /api/v1/staff/:id` — Cập nhật thông tin nhân sự & phân quyền:
  - `HR` được chỉnh sửa toàn bộ thông tin hồ sơ nhân sự (`fullName`, `phone`, `email`, `companyEmail`, `citizenId`, `address`, `department`, `contractType`, `contractStartDate`, `contractEndDate`, `contractFileUrl`, `contractFileName`, `password`, `baseSalary`, `allowance`, `bonus`, `insurance`) — bao gồm tải lên mới, thay thế hoặc xóa file hợp đồng (`contractFileUrl: ""`, `contractFileName: ""`) — và đổi `role` giữa `SALES | HR | ACCOUNTANT | MARKETING`, nhưng **không được phép** nâng quyền user thành `ADMIN` hoặc chỉnh sửa tài khoản `ADMIN` (`403 FORBIDDEN`), và **không được phép** khóa/mở khóa tài khoản (`status`).
  - **Thông tin Lương & Chế độ (`baseSalary` – Lương cơ bản, `allowance` – Trợ cấp, `bonus` – Thưởng, `insurance` – Bảo hiểm)**:
    - **Chỉ duy nhất `HR` (`role === "HR"`)** mới có quyền chỉnh sửa 4 trường này (`403 FORBIDDEN` nếu `ADMIN` hoặc nhân viên tự gửi yêu cầu sửa).
    - Nhân viên được phép **xem** (chỉ đọc) 4 trường Lương cơ bản, Trợ cấp, Thưởng, Bảo hiểm của mình trong trang Hồ sơ cá nhân.
  - Nhân viên thông thường trên Web chỉ được xem/tải về file hợp đồng (`contractFileUrl`, `contractFileName`), không được phép tự chỉnh sửa hoặc xóa file hợp đồng (`403 FORBIDDEN`).
  - `ADMIN` được phép cấp mọi `role` (bao gồm `ADMIN`) và khóa/mở khóa tài khoản (`status: "ACTIVE" | "LOCKED"`).

### 2.2 Danh mục - Category (`/categories`)
- `GET /api/v1/categories`
  - Query: `?status=ACTIVE` (tùy chọn)
  - Response: Danh sách category kèm `productCount` (số sản phẩm thuộc category).
- `POST /api/v1/categories`
  - Body: `{ "code": "AO", "name": "Áo thể thao", "status": "ACTIVE" }`
- `PATCH /api/v1/categories/:id`
  - Body: `{ "name": "string", "status": "ACTIVE | INACTIVE" }`
- `DELETE /api/v1/categories/:id`
  - Quy tắc: Nếu `productCount > 0` trả về `400 Bad Request` (`CATEGORY_HAS_PRODUCTS`: "Không thể xóa category đang có sản phẩm; chỉ được ngừng sử dụng").

### 2.3 Kho hàng, Sản phẩm & Sổ kho (`/products`, `/inventory`)
- `POST /api/v1/products/generate-code`
  - Body: `{ "name": "Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)" }`
  - Response: `{ "data": { "code": "AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L" } }`
- `GET /api/v1/products`
  - Query: `?categoryId=...&search=...&onlySellable=true|false`
  - *(v2.5 — Smart Search & Relevance Ranking)* Tham số `search` hỗ trợ tìm kiếm thông minh tiếng Việt không dấu/có dấu, tách đa từ khóa không liền kề (multi-token), khớp mã SKU/barcode/category/đơn vị, chữ cái đầu (acronym) và chịu lỗi chính tả nhẹ (fuzzy/typo-tolerant), đồng thời sắp xếp kết quả theo điểm độ liên quan giảm dần.
  - Response: `{ "data": [...], "meta": { "totalProducts": 12, "totalStock": 350 } }`
- `POST /api/v1/products`
  - Body: `{ "name": "string", "categoryId": "string", "unit": "Cái | Đôi | Bộ", "quantity"?: 0, "targetWarehouse"?: "FLOOR_1 | FLOOR_2", "sellingPrice": 0, "costPrice": 0, "upsertIfExists"?: boolean }`
  - Lưu ý: `code` tự sinh từ `()` trong `name` và không được sửa sau khi tạo; `stock` khởi tạo = `quantity` (mặc định `0`), cộng vào kho đích `targetWarehouse` (`"FLOOR_1"` = Kho Tầng 1 mặc định, hoặc `"FLOOR_2"` = Kho Tầng 2).
  - *(v1.7 & v1.9)* Khi `ADMIN` truyền `quantity > 0`: tạo sản phẩm với `stock = quantity` (phân bổ vào `stockFloor1` hoặc `stockFloor2` theo `targetWarehouse`) và tự động ghi `StockMovement` loại `IMPORT` (`referenceCode: "CMS-NHAP-THANG"`). Nếu `upsertIfExists = true` và mã sản phẩm đã tồn tại, hệ thống cộng dồn `quantity` vào kho tầng đã chọn (đồng thời cập nhật `costPrice`/`sellingPrice` nếu > 0) và ghi `StockMovement` loại `IMPORT`.
  - `sellingPrice` > 0, `costPrice` > 0 hoặc `quantity` > 0 chỉ được phép khi người gọi có role `ADMIN` (Quản lý/Admin); role khác gửi `sellingPrice > 0` → `403 SELLING_PRICE_FORBIDDEN`, gửi `costPrice > 0` → `403 COST_PRICE_FORBIDDEN`, gửi `quantity > 0` → `403 DIRECT_STOCK_FORBIDDEN`.
- `PATCH /api/v1/products/:id`
  - Body: `{ "name": "string", "categoryId": "string", "unit": "string", "sellingPrice": 250000, "costPrice": 180000, "stock"?: 20, "stockFloor1"?: 12, "stockFloor2"?: 8, "allowDirectStock"?: boolean, "parentSetProductId"?: "string", "packSize"?: 12 }`
  - Lưu ý: Không cho phép sửa `code`. Sửa `stock` / `stockFloor1` / `stockFloor2` trực tiếp mặc định bị chặn (`400 STOCK_DIRECT_EDIT_FORBIDDEN`), trừ khi `ADMIN` gửi kèm `allowDirectStock: true` từ CMS (hệ thống sẽ cập nhật tồn kho tầng + tổng tồn kho và tự động ghi `StockMovement` loại `IMPORT` nếu tăng hoặc `ADJUSTMENT` nếu giảm cho từng kho tầng `FLOOR_1` / `FLOOR_2` tương ứng, kèm `performedBy`, `performedByName`, `performedByRole` để cân bằng Sổ kho).
  - *(v1.1 & v2.4)* Role `ADMIN` và `WAREHOUSE` được phép cập nhật `sellingPrice` và cấu hình liên kết Bộ ↔ Lẻ (`parentSetProductId`, `packSize`); chỉ role `ADMIN` được đổi `costPrice` / `stock` (`allowDirectStock: true`); role khác → `403 SELLING_PRICE_FORBIDDEN` / `403 COST_PRICE_FORBIDDEN` / `403 DIRECT_STOCK_FORBIDDEN`.
- `DELETE /api/v1/products/:id` *(v1.8)*
  - Chỉ role `ADMIN` được xóa sản phẩm (`403 PRODUCT_DELETE_FORBIDDEN` nếu role khác).
  - Xóa sản phẩm theo `id` và dọn các bút toán `StockMovement` liên quan để Báo cáo tồn kho luôn đồng nhất.
  - Response: `{ "data": { "deleted": true, "_id": "...", "code": "...", "name": "..." }, "meta": {} }`
- *(v1.1, v1.6, v1.9 & v3.0)* Trường của `Product`:
  - `costPrice`: giá gốc / giá nhập gần nhất, VND, số nguyên ≥ 0, mặc định `0`. Response `GET /products`, `GET /inventory/report`, `GET /inventory/movements` **ẩn hoàn toàn** `costPrice` với role `SALES`.
  - `stockFloor1`: số lượng tồn tại **Kho Tầng 1** (mặc định bằng `stock` đối với dữ liệu cũ).
  - `stockFloor2`: số lượng tồn tại **Kho Tầng 2** (mặc định `0`).
  - `stock`: tổng tồn kho toàn cửa hàng (`stock = stockFloor1 + stockFloor2`).
  - `parentSetProductId` *(v3.0)*: ID của **Sản phẩm Bộ/Hộp/Ống gốc** liên kết với sản phẩm lẻ này (mặc định `""`).
  - `packSize` *(v3.0)*: Số lượng đơn vị lẻ có trong 1 Bộ/Hộp gốc (VD: `12` quả/ống, `60` cái/hộp; số nguyên ≥ 0, mặc định `0`).
  - Khi gọi `GET /api/v1/products`:
    - Sản phẩm Lẻ có gắn `parentSetProductId` & `packSize > 0` được trả kèm thông tin đối chiếu trực tiếp: `parentSetProductCode`, `parentSetProductName`, `parentSetUnit`, `parentSetStockFloor1`, `parentSetStockFloor2`, `maxUnpackableFloor1` (`= parentSetStockFloor1 * packSize`). Dù `stockFloor1` của Sản phẩm Lẻ đang bằng `0` nhưng `parentSetStockFloor1 > 0`, sản phẩm lẻ vẫn hiển thị trên màn hình POS (`SALES` / `onlySellable=true`) để bán và tự động tách bộ.
    - Sản phẩm Bộ có gắn sản phẩm lẻ con được trả kèm mảng `linkedRetailProducts`: `[{ "_id", "code", "name", "unit", "packSize", "stockFloor1", "stockFloor2", "sellingPrice" }]`.
- `POST /api/v1/inventory/unpack-set` *(v3.0 — Tách Sản phẩm Bộ sang Sản phẩm Lẻ 1 chạm)*
  - Body:
    ```json
    {
      "retailProductId": "string",
      "setsToUnpack": 1,
      "warehouse": "FLOOR_1 | FLOOR_2",
      "color": "",
      "size": "",
      "reason": "Tách bộ ra bán lẻ"
    }
    ```
  - Nghiệp vụ:
    - Kiểm tra sản phẩm lẻ `retailProductId` đã liên kết với `parentSetProductId` và có `packSize >= 1`.
    - Kiểm tra tồn kho của Sản phẩm Bộ tại tầng `warehouse` (mặc định `FLOOR_1`, có xét biến thể `color`/`size` nếu có) ≥ `setsToUnpack`. Nếu tách tại `FLOOR_1` mà Sản phẩm Bộ hết hàng ở Tầng 1 nhưng còn ở Tầng 2 → trả lỗi `400 INSUFFICIENT_SET_FLOOR1_NEED_TRANSFER` nhắc chuyển tầng trước.
    - Trừ `setsToUnpack` vào tồn kho tầng của Sản phẩm Bộ (`-setsToUnpack`), cộng `setsToUnpack * packSize` vào tồn kho tầng của Sản phẩm Lẻ (`+setsToUnpack * packSize`).
    - Ghi 2 bút toán `StockMovement` loại `ADJUSTMENT` (`referenceCode: "TB-xxxx"`) cho cả Sản phẩm Bộ và Sản phẩm Lẻ để cân bằng Sổ kho và Báo cáo xuất nhập tồn.
- `GET /api/v1/inventory/movements`
  - Query: `?productId=...&type=IMPORT|SALE|RETURN|EXCHANGE_IN|EXCHANGE_OUT|ADJUSTMENT|TRANSFER&from=...&to=...`
  - Response: Lịch sử sổ kho (`StockMovement`) kèm `sellingPrice`, `stock` hiện tại, `costPrice` (ẩn `costPrice` nếu role `SALES`) và thông tin người thực hiện (`performedBy`, `performedByName`, `performedByRole`: `"ADMIN" | "WAREHOUSE" | "SALES"`).
- `GET /api/v1/inventory/report`
  - Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=...`
  - Response: Báo cáo kế toán kho theo công thức:
    `closingStock (Tồn cuối kỳ) = openingStock (Tồn đầu kỳ) + importedQty (Nhập trong kỳ) - soldQty (Bán trong kỳ) + adjustedAndReturnedQty (± Điều chỉnh trả/đổi)`
    Kèm `stockFloor1`, `stockFloor2`, `sellingPrice` và `costPrice` của từng sản phẩm (ẩn `costPrice` nếu role `SALES`). Các bút toán chuyển kho nội bộ (`TRANSFER` giữa Tầng 1 ↔ Tầng 2) không làm thay đổi tổng tồn cuối kỳ.
- `POST /api/v1/inventory/adjustments`
  - Body: `{ "productId": "string", "quantityChange": -2, "warehouse"?: "FLOOR_1 | FLOOR_2", "reason": "Kiểm kê lệch phiếu nhập PN-0001" }`
  - Tạo phiếu điều chỉnh kho, cập nhật `stockFloor1`/`stockFloor2` + `stock` sản phẩm và ghi `StockMovement` loại `ADJUSTMENT`.
- `POST /api/v1/inventory/transfers` & `GET /api/v1/inventory/transfers` *(v1.9 & v2.1 — Phiếu Xuất Kho Chuyển Tầng giữa Kho Tầng 1 ↔ Kho Tầng 2, hỗ trợ dời nhiều sản phẩm trong 1 phiếu)*
  - Chỉ role `ADMIN` được phép thực hiện (`403 FORBIDDEN` nếu role khác).
  - Body `POST` (hỗ trợ truyền mảng `items` nhiều sản phẩm hoặc 1 sản phẩm đơn lẻ `productId` + `quantity`):
    ```json
    {
      "fromWarehouse": "FLOOR_1 | FLOOR_2",
      "toWarehouse": "FLOOR_1 | FLOOR_2",
      "note": "Dời hàng từ Kho Tầng 1 xuống Kho Tầng 2",
      "items": [
        { "productId": "...", "quantity": 5 },
        { "productId": "...", "quantity": 3 }
      ]
    }
    ```
  - Nghiệp vụ:
    - Kiểm tra `fromWarehouse !== toWarehouse` và tồn kho tại kho nguồn (`stockFloor1` hoặc `stockFloor2`) ≥ tổng `quantity` yêu cầu của từng sản phẩm trong phiếu (nếu thiếu → `400 INSUFFICIENT_FLOOR_STOCK`).
    - Trừ `quantity` ở kho nguồn, cộng `quantity` vào kho đích cho toàn bộ sản phẩm trong phiếu (tổng `stock` không đổi).
    - Sinh chung 1 mã phiếu xuất kho chuyển tầng `PXK-0001` cho tất cả các dòng sản phẩm trong cùng phiếu, ghi `StockMovement` loại `TRANSFER` (`referenceType: "TRANSFER"`, `fromWarehouse`, `toWarehouse`).
    - Ghi nhận vào **Báo cáo hoạt động nhân viên** (`GET /api/v1/reports/staff-activity`) với loại hoạt động kho `EXPORT_TRANSFER`.

### 2.4 Nhập kho (`/imports`)
- `GET /api/v1/imports` — Danh sách phiếu nhập kho (`DRAFT`, `CHECKING`, `COMPLETED`), kèm thông tin người lập (`createdBy`, `createdByName`, `createdByRole`: `"ADMIN" | "WAREHOUSE"`), người hoàn thành (`completedBy`, `completedByName`, `completedByRole`: `"ADMIN" | "WAREHOUSE"`), và trên từng dòng hàng có người kiểm (`checkedBy`, `checkedByName`, `checkedByRole`, `scanCounts: [{ "userId", "name", "role", "quantity" }]`).
- `GET /api/v1/imports/:id` — Chi tiết phiếu nhập kho (bao gồm toàn bộ thông tin người lập, người kiểm, người hoàn thành kèm vai trò `ADMIN` hoặc `WAREHOUSE`).
- `POST /api/v1/imports/ocr-preview`
  - Body: `{ "imageText": "string" }` (mỗi dòng: `Tên hàng | ĐVT | Số lượng | Ghi chú`)
  - Tách văn bản thành danh sách 6 cột (`stt`, `productCode`, `productName`, `unit`, `expectedQuantity`, `note`) để người dùng xem lại và chỉnh sửa. Không còn trả dữ liệu mẫu.
- `POST /api/v1/imports/ocr-scan` *(mới)*
  - Quét ảnh chụp từ camera / file tải lên (ảnh JPG/PNG/WEBP hoặc PDF) bằng OCR.
  - Body:
    ```json
    {
      "mode": "TABLE | TAG",
      "fileBase64": "<base64 không kèm tiền tố data:>",
      "mimeType": "image/jpeg | image/png | image/webp | application/pdf"
    }
    ```
  - Giới hạn: file ≤ 8MB sau khi mã hóa.
  - Engine: dùng Gemini Vision nếu server có `GEMINI_API_KEY` (model theo `GEMINI_MODEL`, mặc định thử lần lượt `gemini-3.5-flash` → `gemini-3.8-flash` → `gemini-3.1-flash-lite`; tự chuyển model khi model bị ngừng, quá tải 429/5xx hoặc quá `GEMINI_TIMEOUT_MS`); nếu không thì fallback Tesseract (chỉ ảnh, ngôn ngữ `vie+eng`, độ chính xác thấp hơn, không hỗ trợ PDF).
  - Response `mode = TABLE`: `{ "data": { "items": [6 cột như trên], "rawText": "...", "engine": "gemini | tesseract" } }`
  - Response `mode = TAG`: `{ "data": { "productCode": "...", "productName": "...", "quantity": number | null, "rawText": "...", "engine": "..." } }`
  - Lỗi: `400 OCR_INVALID_FILE`, `413 OCR_FILE_TOO_LARGE`, `422 OCR_UNSUPPORTED` (PDF khi không có Gemini), `502 OCR_ENGINE_ERROR`.
- `POST /api/v1/imports`
  - Tạo phiếu nhập mới (mặc định trạng thái `DRAFT`).
  - *(v1.9)* Trường `targetWarehouse`: `"FLOOR_1"` (Kho Tầng 1 — mặc định) hoặc `"FLOOR_2"` (Kho Tầng 2). Khi hoàn thành phiếu nhập (`POST /api/v1/imports/:id/complete`), số lượng thực nhận (`actualQuantity`) sẽ được cộng vào đúng kho tầng đã chọn (`stockFloor1` hoặc `stockFloor2`) và cập nhật tổng `stock`.
  - Body:
    ```json
    {
      "note": "Nhập hàng đợt 1",
      "defaultCategoryId": "...",
      "items": [
        {
          "stt": 1,
          "productCode": "AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L",
          "productName": "Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)",
          "categoryId": "...",
          "unit": "Cái",
          "expectedQuantity": 20,
          "actualQuantity": 20,
          "costPrice": 180000,
          "note": "",
          "isChecked": false,
          "isConfirmed": false,
          "discrepancyNote": ""
        }
      ]
    }
    ```
  - *(v1.1 & v2.4)* `costPrice`: **giá gốc (đơn giá nhập)** do thủ kho nhập, VND, số nguyên ≥ 0 (không bắt buộc, mặc định `0`, âm → `400 INVALID_COST_PRICE`). `sellingPrice`: **giá bán niêm yết** do thủ kho (`WAREHOUSE`) hoặc Quản lý (`ADMIN`) nhập khi lập phiếu nhập kho, VND, số nguyên ≥ 0 (không bắt buộc, mặc định `0`, âm → `400 INVALID_SELLING_PRICE`).
- `PUT /api/v1/imports/:id`
  - Lưu nháp hoặc cập nhật danh sách dòng hàng, trạng thái kiểm hàng (`DRAFT` hoặc `CHECKING`). Chặn sửa nếu phiếu đã `COMPLETED`.
- `DELETE /api/v1/imports/:id` *(v1.8)*
  - Xóa phiếu nhập kho.
  - Phiếu ở trạng thái `DRAFT` hoặc `CHECKING`: cho phép xóa trực tiếp.
  - Phiếu đã `COMPLETED`: chỉ role `ADMIN` mới được xóa (khi xóa sẽ hoàn tác số lượng đã cộng vào kho và xóa các bút toán `StockMovement` của phiếu đó); role khác gọi sẽ nhận `400 IMPORT_RECEIPT_LOCKED`.
  - Response: `{ "data": { "deleted": true, "_id": "...", "code": "..." }, "meta": {} }`
- `POST /api/v1/imports/:id/finish-listing`
  - Bước 3 ("Hoàn tất" danh sách dự kiến): chuyển trạng thái từ `DRAFT` sang `CHECKING`.
- `POST /api/v1/imports/:id/scan-check`
  - Bước 4 ("Kiểm tra hàng thực tế" bằng chụp tag):
  - Body: `{ "query"?: "mã hoặc tên hàng", "productCode"?: "...", "productName"?: "...", "rawText"?: "...", "rowIndex"?: 0, "delta"?: 1 | -1 }` (cần ít nhất `query`/`productCode`/`productName` hoặc `rowIndex`)
  - *(v1.3)* **Đếm từng chiếc**: mỗi lần quét khớp = +1 vào `scannedQuantity` của dòng (trường mới của dòng phiếu nhập, mặc định `0`).
    - `actualQuantity = scannedQuantity`, `isChecked = true` (đã bắt đầu kiểm).
    - `isConfirmed = true` (tick xác nhận nhập kho) khi `scannedQuantity >= expectedQuantity`.
    - Dòng đã đủ số lượng mà quét tiếp → **không cộng**, trả `alreadyFull = true` kèm cảnh báo.
    - Có nhiều dòng cùng điểm khớp → ưu tiên dòng **chưa đủ** số lượng; vẫn không phân định được → `ambiguous` + `candidates`, client gửi lại với `rowIndex`.
    - `delta = -1`: hoàn tác 1 lần quét của dòng (`rowIndex` bắt buộc), không xuống dưới 0.
    - Không bao giờ thêm dòng mới; tag không có trong danh sách → `matched = false` + `warning`.
    - *(v1.4)* Ghi nhận người kiểm theo user đăng nhập: dòng phiếu có thêm `checkedBy`, `checkedByName`, `checkedAt` (lần quét gần nhất) và `scanCounts: [{ "userId", "name", "quantity" }]` (số chiếc mỗi nhân viên đã quét). Các trường này được giữ nguyên khi `PUT`/`finish-listing`/`complete` gửi lại `items`.
  - Response: `{ "data": { "matched": boolean, "alreadyFull"?: boolean, "isFull"?: boolean, "scannedQuantity"?: 1, "expectedQuantity"?: 2, "ambiguous"?: boolean, "candidates"?: [{ "index", "productCode", "productName", "scannedQuantity", "expectedQuantity" }], "matchedIndex"?: number, "matchedItem"?: {...}, "warning"?: "string", "progress": { "checked": 3, "total": 10, "scannedUnits": 25, "expectedUnits": 40 }, "receipt": {...} } }`
    - `progress.checked` = số dòng đã đủ số lượng.
  - Chỉ cho phép khi phiếu ở trạng thái `CHECKING` (`400 IMPORT_NOT_CHECKING`); phiếu `COMPLETED` → `400 IMPORT_RECEIPT_LOCKED`.
- `POST /api/v1/imports/:id/scan-tag` *(v1.5 — chụp tag 1 request, mục tiêu ≤ 5s)*
  - Gộp OCR tag + đối chiếu + đếm chiếc trong **một** request (thay cho `ocr-scan` → `scan-check` nối tiếp).
  - Body: `{ "fileBase64"?: "<ảnh JPEG đã cắt theo khung ngắm>", "mimeType"?: "image/jpeg", "barcode"?: "8935364308672" }` (cần `fileBase64` hoặc `barcode`)
  - Thứ tự xử lý:
    1. Có `barcode` (trình duyệt tự đọc mã vạch) và mã này đã được **ghi nhớ** trên dòng phiếu (`items[].barcode`) hoặc trên sản phẩm (`Product.barcode`) → khớp ngay, **không gọi OCR**.
    2. Ngược lại → OCR tag (Gemini, model nhanh trước, tắt thinking, **hạn chót 5s**, gửi thêm model dự phòng song song nếu sau ~2,5s chưa có kết quả) → so khớp như `scan-check`.
    3. Khớp thành công và có mã vạch (từ trình duyệt hoặc OCR đọc được) → ghi nhớ vào `items[].barcode` để các chiếc sau khớp tức thì.
  - Response: giống `scan-check` (v1.3) và thêm `"source": "barcode" | "ocr"`, `"barcode"`, `"ocr": { "productName", "productCode", "barcode", "model" } | null`, `"timing": { "ocrMs", "totalMs" }`. Header `Server-Timing: ocr;dur=..., total;dur=...`.
  - OCR không đọc được chữ nào → `matched = false`, `unreadable = true`.
  - Lỗi: `400 IMPORT_NOT_CHECKING`, `400 IMPORT_RECEIPT_LOCKED`, `400 OCR_INVALID_FILE`, `504 OCR_TIMEOUT` (quá 5s, client hiển thị "chụp lại"), `502 OCR_ENGINE_ERROR`.
  - Trường mới: `items[].barcode` (server ghi, được giữ khi client `PUT` lại items), `Product.barcode` (cập nhật khi hoàn thành nhập kho nếu sản phẩm chưa có).
- *(v1.5)* `POST /api/v1/imports/ocr-scan` chế độ `TAG`: cùng cấu hình tăng tốc (model nhanh trước, tắt thinking, hạn chót 5s); response thêm `barcode`, `codes`. Chế độ `TABLE`: tắt thinking, thời gian chờ mỗi model giảm còn 20s.
- *(v1.5)* **Chống ngủ server (Render Free)**: server tự gọi `GET {KEEP_ALIVE_URL | RENDER_EXTERNAL_URL}/api/v1/health` mỗi `KEEP_ALIVE_INTERVAL_MIN` phút (mặc định 8, giới hạn 5–10).
- `POST /api/v1/imports/:id/complete`
  - Bước 7 ("Hoàn thành" nhập kho):
  - Chỉ các dòng có `isConfirmed === true` mới được cộng `actualQuantity` vào tồn kho (tự tạo sản phẩm mới nếu `productCode` chưa có trong hệ thống), ghi `StockMovement` loại `IMPORT`, và khóa phiếu (`status = "COMPLETED"`).
  - *(v1.1 & v2.4)* Với mỗi dòng xác nhận có `costPrice > 0`: cập nhật `Product.costPrice = costPrice` (giá nhập gần nhất). Với mỗi dòng xác nhận có `sellingPrice > 0`: cập nhật `Product.sellingPrice = sellingPrice` (giá bán niêm yết). Sản phẩm tự tạo mới nhận `costPrice` và `sellingPrice` theo dòng nhập (mặc định `0` nếu không nhập).

### 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`)
- `GET /api/v1/customers/lookup?phone=...`
  - Tra cứu khách hàng theo SĐT (tự động chuẩn hóa khoảng trắng, dấu chấm/gạch và đầu số `+84`/`84` về `0`), trả về thông tin khách hàng và lịch sử đơn hàng + phiếu trả/đổi.
- `GET /api/v1/customers` — Danh sách khách hàng (hỗ trợ `?search=...` tìm thông minh theo SĐT chuẩn hóa hoặc tên tiếng Việt không dấu/đa từ khóa, sắp xếp theo độ liên quan).
- `GET /api/v1/orders` — Danh sách đơn hàng (lọc theo `search`, `phone`, `status`, `paymentMethod`; `search` hỗ trợ tìm không dấu/đa từ khóa trên mã đơn, tên/SĐT khách, mã/tên sản phẩm trong đơn, nhân viên bán, ghi chú).
- `GET /api/v1/orders/:id` — Chi tiết đơn hàng (hoặc tra theo `orderCode` qua `GET /api/v1/orders/by-code/:code`)
- `POST /api/v1/orders` *(Cập nhật v2.2 — Chỉ bán tồn Kho Tầng 1 + Giảm giá Sản phẩm, Tặng hàng 0đ & Giảm giá Bill)*
  - Body:
    ```json
    {
      "customerName": "Trần Minh Khách",
      "customerPhone": "0901234567",
      "paymentMethod": "CASH | BANKING | CARD | OTHER",
      "paymentMethodDetail": "Tiền mặt + Chuyển khoản",
      "hasCardFee": true,
      "cardFeePercent": 1.8,
      "billDiscountType": "NONE | PERCENT | AMOUNT",
      "billDiscountValue": 10,
      "note": "Giá đã bao gồm thuế",
      "items": [
        {
          "productId": "...",
          "quantity": 2,
          "discountType": "NONE | PERCENT | AMOUNT | GIFT",
          "discountValue": 50000,
          "isGift": false
        }
      ]
    }
    ```
  - Nghiệp vụ:
    - **Chỉ bán/xuất tặng từ Kho Tầng 1 (`stockFloor1`) & Tự động tách Bộ sang Lẻ *(v3.0)***:
      - Kiểm tra sản phẩm có `sellingPrice > 0`.
      - Nếu sản phẩm là **Sản phẩm Lẻ** có cấu hình `parentSetProductId` & `packSize > 0` mà `stockFloor1 < quantity`: hệ thống tự động kiểm tra tồn Kho Tầng 1 của **Sản phẩm Bộ gốc** (trừ đi số lượng Bộ cũng đang mua trong cùng đơn nếu có). Nếu Kho Tầng 1 của Sản phẩm Bộ đủ số bộ cần tách (`neededSets = ceil((quantity - stockFloor1) / packSize)`), hệ thống **tự động trừ `neededSets` ở Sản phẩm Bộ (`-neededSets` Tầng 1)**, **cộng `neededSets * packSize` vào Sản phẩm Lẻ (`+neededSets * packSize` Tầng 1)**, ghi 2 bút toán `StockMovement` (`ADJUSTMENT`), rồi trừ số lượng bán như bình thường.
      - Nếu Sản phẩm Bộ hết hàng ở Kho Tầng 1 nhưng còn ở Kho Tầng 2 → trả lỗi `400 INSUFFICIENT_SET_FLOOR1_NEED_TRANSFER` nhắc chuyển tầng Sản phẩm Bộ xuống Kho Tầng 1 trước. Nếu cả Lẻ và Bộ đều không đủ → trả lỗi `400 INSUFFICIENT_STOCK`.
    - **Giảm giá từng sản phẩm & Tặng hàng (`discountType`, `discountValue`, `isGift`)**:
      - `originalUnitPrice = product.sellingPrice`.
      - Nếu `discountType === "GIFT"` (hoặc `isGift === true`):
        - Mặt hàng được đánh dấu là **Hàng tặng (`isGift = true`, `discountType = "GIFT"`)**.
        - Không tính tiền: `unitPrice = 0`, `lineTotal = 0`, `discountAmount = 0`, không cộng vào `rawSubtotal`.
        - Hiển thị rõ trên hóa đơn (Bill K80/A4) kèm nhãn hàng tặng và vẫn trừ trực tiếp số lượng vào **Kho Tầng 1 (`stockFloor1`)**.
      - Nếu `discountType === "PERCENT"` (`0..100`): số tiền giảm trên 1 SP = `Math.round(originalUnitPrice * discountValue / 100)`.
      - Nếu `discountType === "AMOUNT"`: số tiền giảm trên 1 SP = `Math.min(originalUnitPrice, Math.max(0, Math.round(discountValue)))`.
      - Với hàng bán thường (`discountType !== "GIFT"`):
        - `unitPrice = Math.max(0, originalUnitPrice - discountPerUnit)` (đơn giá sau giảm).
        - `discountAmount = discountPerUnit * quantity` (tổng giảm của dòng SP).
        - `lineTotal = unitPrice * quantity`.
    - **Giảm giá tổng Bill (`billDiscountType`, `billDiscountValue`) — có thể áp dụng đồng thời với giảm giá sản phẩm**:
      - `rawSubtotal = sum(originalUnitPrice * quantity)` (chỉ tính các dòng hàng bán không phải `GIFT`).
      - `subtotal = sum(lineTotal)` (tổng tiền hàng sau giảm giá từng SP).
      - Nếu `billDiscountType === "PERCENT"` (`0..100`): `billDiscountAmount = Math.round(subtotal * billDiscountValue / 100)`.
      - Nếu `billDiscountType === "AMOUNT"`: `billDiscountAmount = Math.min(subtotal, Math.max(0, Math.round(billDiscountValue)))`.
      - Tiền hàng sau giảm giá Bill: `afterBillDiscount = Math.max(0, subtotal - billDiscountAmount)`.
    - **Phí quẹt thẻ (Khách Việt 1.8% / Khách nước ngoài 4%) & Tổng thanh toán**:
      - Nếu `paymentMethod === "CARD"`: hỗ trợ chọn `cardFeePercent` là `1.8` (Khách Việt 1.8%, mặc định) hoặc `4` (Khách nước ngoài 4%). Khi áp dụng phí thẻ (`hasCardFee !== false` và `cardFeePercent > 0`), `cardFee = Math.round(afterBillDiscount * (cardFeePercent / 100))`, ngược lại `cardFee = 0`.
      - `totalAmount = afterBillDiscount + cardFee`.
    - **Lưu Bản Nháp Hóa Đơn (`status === "DRAFT"` hoặc `isDraft === true`) *(v2.8)***:
      - Mọi nhân viên Sales và Admin đều nhìn thấy toàn bộ danh sách hóa đơn nháp (`GET /api/v1/orders?status=DRAFT`) để phối hợp phục vụ khách.
      - Khi lưu bản nháp (`DRAFT`), hệ thống bắt buộc nhập đầy đủ thông tin khách hàng (`customerName`, `customerPhone`), ghi nhận **Người tạo nháp** (`createdBy`, `createdByName`), lưu hóa đơn vào CSDL nhưng **chưa trừ tồn kho** (`stockFloor1` giữ nguyên), chưa ghi `StockMovement`, chưa cộng doanh thu.
      - Khi chốt thanh toán (`status === "PAID"`), hệ thống ghi nhận thêm **Người chốt thanh toán** (`confirmedBy`, `confirmedByName`, `confirmedAt`), kiểm tra lại tồn kho thực tế tại thời điểm thanh toán (`stockFloor1 >= requestedQty` — nếu lúc tạo nháp còn hàng nhưng đến lúc thanh toán kho đã hết/thiếu thì chặn ngay với lỗi `400 INSUFFICIENT_STOCK` và giữ nguyên trạng thái `DRAFT`), trừ trực tiếp `stockFloor1` (và `stock`), ghi `StockMovement` loại `SALE` (`warehouseLocation: "FLOOR_1"`), cập nhật/tạo `Customer` theo SĐT.
- `PUT /api/v1/orders/:id` *(v2.8)* — Cập nhật nội dung hóa đơn nháp (`status === "DRAFT"`), chưa trừ kho (hoặc truyền `status: "PAID"` để chốt thanh toán và trừ kho Tầng 1).
- `POST /api/v1/orders/:id/confirm` *(v2.8)* — Xác nhận thanh toán cho hóa đơn nháp (`DRAFT` → `PAID`), thực hiện kiểm tra và trừ tồn Kho Tầng 1, ghi `StockMovement` loại `SALE` và cập nhật `Customer`.
- `DELETE /api/v1/orders/:id` *(v2.8)* — Xóa hóa đơn đang ở trạng thái `DRAFT` (chặn xóa nếu đơn đã `PAID` → `400 ORDER_ALREADY_PAID`).

### 2.6 Trả / Đổi hàng (`/returns`)
- `GET /api/v1/returns` — Danh sách phiếu trả/đổi (CMS & POS)
- `POST /api/v1/returns/calculate` — Tính thử số tiền hoàn lại / khách trả thêm trước khi xác nhận
- `POST /api/v1/returns`
  - Body:
    ```json
    {
      "orderId": "...",
      "type": "RETURN | EXCHANGE",
      "refundMethod": "CASH | BANKING | CARD",
      "note": "Đổi size XL",
      "returnItems": [
        {
          "productId": "...",
          "quantity": 1,
          "condition": "GOOD | DAMAGED"
        }
      ],
      "exchangeItems": [
        {
          "productId": "...",
          "quantity": 1
        }
      ]
    }
    ```
  - Nghiệp vụ:
    - Kiểm tra số lượng trả không vượt quá `purchasedQty - alreadyReturnedQty`.
    - Hàng trả có `condition === "GOOD"` được cộng lại vào tồn kho (`+quantity`), ghi `StockMovement` loại `RETURN` / `EXCHANGE_IN`. Hàng `DAMAGED` không cộng tồn kho bán.
    - Hàng đổi mới (`exchangeItems`) kiểm tra tồn kho, trừ tồn kho (`-quantity`), ghi `StockMovement` loại `EXCHANGE_OUT`.
    - Tính `returnTotal`, `exchangeTotal`, `netDifference = exchangeTotal - returnTotal` (dương: khách trả thêm, âm: cửa hàng hoàn tiền).
    - Cập nhật trạng thái đơn hàng gốc (`PARTIALLY_RETURNED` hoặc `FULLY_RETURNED`).

### 2.7 Báo cáo hoạt động nhân viên (`/reports/staff-activity`) *(v1.4)*
- `GET /api/v1/reports/staff-activity?from=YYYY-MM-DD&to=YYYY-MM-DD&staffId=...`
  - Chỉ role `ADMIN` (Quản lý) → role khác `403 FORBIDDEN`.
  - Mặc định không truyền `from`/`to` = toàn bộ thời gian.
  - Response:
    ```json
    {
      "data": {
        "staff": [{
          "staffId": "...", "code": "NV002", "fullName": "...", "username": "...", "role": "SALES|WAREHOUSE|ADMIN", "status": "ACTIVE|LOCKED",
          "sales": { "orders": 12, "revenue": 3500000, "units": 20, "returnsHandled": 1, "returnTotal": 250000 },
          "warehouse": { "importsCreated": 2, "importsCompleted": 1, "unitsScanned": 40, "rowsChecked": 10, "unitsImported": 38, "adjustments": 1, "transfers": 1, "unitsTransferred": 5 },
          "lastActivityAt": "ISO date | null"
        }],
        "sales": [{ "type": "ORDER|RETURN|EXCHANGE", "at": "...", "staffId": "...", "staffName": "...", "referenceCode": "HD-0001", "customerName": "...", "amount": 350000, "units": 2, "paymentMethod": "CASH", "status": "PAID" }],
        "warehouse": [{ "type": "IMPORT_CREATED|IMPORT_CHECKED|IMPORT_COMPLETED|ADJUSTMENT|EXPORT_TRANSFER", "at": "...", "staffId": "...", "staffName": "...", "referenceCode": "PN-0001 | PXK-0001", "quantity": 10, "detail": "..." }]
      },
      "meta": { "from": "...|null", "to": "...|null" }
    }
    ```
  - Nguồn dữ liệu: đơn hàng (`createdBy`), phiếu trả/đổi (`performedBy`), phiếu nhập (`createdBy`, `completedBy`, `items[].scanCounts`), sổ kho loại `ADJUSTMENT` (`performedBy`). Thao tác không gắn được với nhân viên nào được gom vào dòng "Không xác định" (`staffId = ""`).

### 2.8 Dashboard Doanh thu chi tiết & Phân tích Sản phẩm (`/reports/revenue-dashboard`) *(v2.3)*
- `GET /api/v1/reports/revenue-dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=...&paymentMethod=...`
  - Chỉ role `ADMIN` (Quản lý) → role khác `403 FORBIDDEN`.
  - Trả về:
    - `summary`: Tổng hợp doanh thu gộp (`grossRevenue`), giảm giá sản phẩm (`itemDiscountTotal`), giảm giá Bill (`billDiscountTotal`), phí quẹt thẻ (`cardFeeTotal`), doanh thu đơn hàng (`orderRevenue`), hoàn trả/đổi chênh lệch (`netReturnRefund`), doanh thu thuần (`netRevenue`), giá vốn hàng bán (`estimatedCogs`), lãi gộp thực tế (`grossProfit`), tỷ suất lãi gộp (`grossMarginPercent`), tổng số đơn (`totalOrders`), giá trị đơn trung bình (`avgOrderValue`), tổng sản phẩm bán (`totalUnitsSold`), sản phẩm tặng (`totalGiftUnits`).
    - `byPaymentMethod`: Cơ cấu doanh thu theo hình thức thanh toán (`CASH`, `BANKING`, `CARD`, `OTHER`).
    - `byCategory`: Cơ cấu doanh thu, số lượng bán, giá vốn và lãi gộp theo từng Category.
    - `dailyTrend`: Chuỗi doanh thu & lợi nhuận theo từng ngày trong kỳ (tự động điền đầy đủ các ngày trong khoảng `from` – `to` để vẽ biểu đồ xu hướng).
    - `hourlyTrend`: Chuỗi doanh thu & lợi nhuận theo từng khung giờ (`00:00` – `23:00`) của các giao dịch trong kỳ.
    - `topSellingProducts`: Danh sách sản phẩm bán chạy nhất trong kỳ kèm tồn kho hiện tại (`stockFloor1`, `stockFloor2`, `stock`) và cảnh báo cần nhập thêm / dời từ Tầng 2 xuống Tầng 1 (`restockAlert`).
    - `needsPushProducts`: Danh sách sản phẩm đang cần đẩy mạnh (được tách sang phân hệ riêng của `MARKETING`, đã gỡ bỏ khỏi giao diện CMS `ADMIN`).
- `GET /api/v1/reports/push-products?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=...`
  - Cho phép role `MARKETING`, `ADMIN`, `ACCOUNTANT` truy cập để bộ phận Marketing quan sát danh sách **Các Sản Phẩm Đang Cần Đẩy Mạnh**.
  - Trả về:
    - `summary`: `{ totalPushProducts, zeroSalesCount, highCapitalCount, floor2OnlyCount, noPriceCount, totalPushStock, totalPushCapitalValue }`
    - `needsPushProducts`: Danh sách sản phẩm đang cần đẩy mạnh (`ProductSalesAnalysisRow[]`) kèm tồn kho Tầng 1 / Tầng 2, số lượng đã bán trong kỳ, giá gốc / giá bán, vốn tồn đọng (`inventoryCostValue`), lý do cần đẩy mạnh (`pushReasons`) và đề xuất hành động (`suggestedAction`).
    - `categories`: Danh sách Category để lọc.


### 2.9 Tích hợp Wise API — Máy tính Quy đổi Ngoại tệ & Chuyển tiền nhanh (`/wise`) *(v2.6)*
- `GET /api/v1/wise/currencies`
  - Trả về danh sách các đồng tiền hỗ trợ quy đổi nhanh trên POS (`VND`, `USD`, `EUR`, `GBP`, `AUD`, `SGD`, `CAD`, `JPY`, `KRW`, `THB`, `CHF`, `CNY`, `HKD`, `MYR`, `TWD`) kèm thông tin chế độ kết nối Wise (`mode`: `"LIVE_AUTHENTICATED" | "LIVE_PUBLIC" | "SANDBOX"`).
- `POST /api/v1/wise/quote`
  - Body:
    ```json
    {
      "sourceCurrency": "USD",
      "targetCurrency": "VND",
      "sourceAmount": 100,
      "targetAmount": null
    }
    ```
  - Nghiệp vụ:
    - Gọi trực tiếp Wise API `POST /v3/quotes` (kèm `Authorization: Bearer <WISE_API_TOKEN>` nếu có cấu hình trong `.env`, hoặc sử dụng Unauthenticated Quote trực tiếp từ `https://api.wise.com/v3/quotes`).
    - **Xử lý thông minh chiều `VND -> Ngoại tệ`**: Vì Wise không cho phép `sourceCurrency = "VND"` trực tiếp (trả về `422`), khi người dùng chọn đổi từ `VND` sang ngoại tệ (VD: khách hỏi `10,000,000 VND` tương đương bao nhiêu `USD` trên Wise), server tự động truy vấn chiều đối ứng (`targetCurrency -> VND`) trên Wise để lấy chính xác tỷ giá mid-market thực tế (`rate`), phí dịch vụ Wise (`fee`) theo từng phương thức (`BANK_TRANSFER`, `DEBIT`, `CREDIT`, `BALANCE`...) và tính ra số tiền ngoại tệ cần gửi / thực nhận để nhân viên báo ngay cho khách.
    - Nếu kết nối mạng tới Wise gặp sự cố, tự động fallback về tỷ giá tham chiếu dự phòng kèm cờ `isFallback: true`.
  - Response:
    ```json
    {
      "data": {
        "sourceCurrency": "USD",
        "targetCurrency": "VND",
        "sourceAmount": 100,
        "targetAmount": 2532355,
        "rate": 25803.5,
        "inverseRate": 0.00003875,
        "rateTimestamp": "2026-10-31T10:49:01Z",
        "isReversedCorridor": false,
        "isFallback": false,
        "mode": "LIVE_PUBLIC",
        "selectedOption": {
          "payIn": "DEBIT",
          "payOut": "BANK_TRANSFER",
          "sourceAmount": 100,
          "targetAmount": 2489006,
          "feeTotal": 3.54,
          "feeTransferwise": 2.31,
          "feePayIn": 1.23,
          "feeCurrency": "USD",
          "feePercentage": 3.54,
          "formattedEstimatedDelivery": "in 30 minutes"
        },
        "paymentOptions": []
      },
      "meta": {}
    }
    ```
- `POST /api/v1/wise/transfers`
  - Tạo lệnh chuyển tiền nhanh qua Wise (nếu cấu hình `WISE_API_TOKEN` thật sẽ gọi luồng `Profile -> Quote -> Transfer` của Wise; nếu chưa cấu hình token sẽ tạo phiếu mô phỏng Sandbox/Quote Ticket để lưu/copy báo giá gửi khách).
  - Body:
    ```json
    {
      "sourceCurrency": "USD",
      "targetCurrency": "VND",
      "sourceAmount": 100,
      "recipientName": "Nguyen Van A",
      "recipientAccount": "1903...",
      "recipientBank": "Techcombank",
      "note": "Báo giá chuyển tiền Wise tại quầy"
    }
    ```


### 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*
- `GET /api/v1/promotions`
  - Query: `?activeOnly=true|false&search=...`
  - Trả về danh sách chương trình khuyến mãi kèm trạng thái hiệu lực thực tế (`isCurrentlyActive: boolean`, `effectiveStatus: "RUNNING_PERMANENT" | "RUNNING" | "UPCOMING" | "EXPIRED" | "PAUSED"`). Khi `activeOnly=true`, chỉ trả về các chương trình đang bật (`status === "ACTIVE"`) và đang trong thời gian hiệu lực (hoặc `isPermanent === true`).
- `POST /api/v1/promotions`
  - Chỉ role `ADMIN` được phép tạo (`403 FORBIDDEN` nếu role khác).
  - Body:
    ```json
    {
      "name": "Mua Vợt Pickleball tặng kèm Quấn cán & Dán viền",
      "description": "Áp dụng tự động khi thêm vợt vào giỏ hàng POS",
      "status": "ACTIVE",
      "isPermanent": true,
      "startDate": null,
      "endDate": null,
      "conditionType": "BUY_PRODUCTS | BUY_CATEGORY | ALL_PRODUCTS",
      "conditionProductIds": ["..."],
      "conditionCategoryIds": ["..."],
      "minQuantity": 1,
      "minOrderAmount": 0,
      "giftItems": [
        { "productId": "...", "quantity": 1 }
      ],
      "multiplyGiftByConditionQty": true,
      "itemDiscountType": "NONE | PERCENT | AMOUNT",
      "itemDiscountValue": 0,
      "billDiscountType": "NONE | PERCENT | AMOUNT",
      "billDiscountValue": 0
    }
    ```
  - Quy tắc:
    - `name` bắt buộc (`400 VALIDATION_ERROR`).
    - Phải có ít nhất 1 ưu đãi: `giftItems.length > 0` hoặc `itemDiscountType !== "NONE"` (`itemDiscountValue > 0`) hoặc `billDiscountType !== "NONE"` (`billDiscountValue > 0`).
    - Nếu `isPermanent === false`: kiểm tra `startDate` / `endDate` hợp lệ (nếu có cả 2 thì `endDate >= startDate`).
- `PATCH /api/v1/promotions/:id`
  - Chỉ role `ADMIN` được phép cập nhật thông tin chương trình, thời gian, điều kiện, quà tặng/giảm giá hoặc bật/tắt (`status: "ACTIVE" | "PAUSED"`).
- `DELETE /api/v1/promotions/:id`
  - Chỉ role `ADMIN` được phép xóa chương trình khuyến mãi.
- `POST /api/v1/promotions/evaluate`
  - Kiểm tra giỏ hàng POS hiện tại khớp với các chương trình khuyến mãi đang hiệu lực và trả về:
    - Danh sách chương trình được kích hoạt (`appliedPromotions`).
    - Danh sách sản phẩm/phụ kiện tặng kèm tự động (`autoGiftItems`).
    - Mức giảm giá tự động cho từng dòng sản phẩm (`itemDiscounts`) và giảm giá tổng Bill (`billDiscount`).


---

### 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*
- **Quy tắc sinh Mã sản phẩm (`POST /api/v1/products/generate-code` & `generateProductCode`)**:
  - Chuyển toàn bộ về **CHỮ IN HOA, bỏ dấu tiếng Việt, viết liền hoàn toàn (không khoảng trắng, không ký tự đặc biệt `_` hay `-`)** theo công thức `[LOẠI][HÃNG][MẪU]`.
  - Tự động loại bỏ hậu tố màu sắc / kích cỡ (`size S/M/L/XL/38..45`, `màu Đỏ/Trắng/Xanh/Gray/Blue/Pink...`) khi sinh mã gốc để các phân loại cùng mẫu quy về **1 Mã sản phẩm duy nhất** (VD: `Áo Kamito Pro - Đỏ - Size L` -> Mã `AOKAMITOPRO`, `color: "Đỏ"`, `size: "L"`).
  - Mã in lên tem nhãn Label (`barcode`) chỉ sử dụng chính Mã sản phẩm chung (`code`), không ghép thêm Size/Màu.
- **Cấu trúc `Product` & `variants[]`**:
  ```json
  {
    "_id": "...",
    "code": "AOKAMITOPRO",
    "barcode": "AOKAMITOPRO",
    "name": "Áo Kamito Pro",
    "brand": "Kamito",
    "modelName": "Pro",
    "categoryId": "...",
    "categoryCode": "AO",
    "categoryName": "Áo thể thao",
    "unit": "Cái",
    "costPrice": 180000,
    "sellingPrice": 350000,
    "stockFloor1": 25,
    "stockFloor2": 30,
    "stock": 55,
    "variants": [
      {
        "variantKey": "DO_M",
        "color": "Đỏ",
        "size": "M",
        "stockFloor1": 10,
        "stockFloor2": 15,
        "stock": 25
      },
      {
        "variantKey": "DO_L",
        "color": "Đỏ",
        "size": "L",
        "stockFloor1": 15,
        "stockFloor2": 15,
        "stock": 30
      }
    ]
  }
  ```
- **API Bóc tách File PDF / Excel khi Nhập kho (`POST /api/v1/imports/parse-file`)**:
  - Body:
    ```json
    {
      "fileName": "phieu-nhap-hang.xlsx",
      "fileType": "EXCEL | CSV | PDF",
      "contentBase64": "...",
      "rawText": "...",
      "rows": [
        {
          "category": "Áo",
          "brand": "Kamito",
          "productName": "Áo Kamito Pro",
          "color": "Đỏ",
          "size": "L",
          "unit": "Cái",
          "expectedQuantity": 15,
          "costPrice": 180000,
          "sellingPrice": 350000
        }
      ],
      "defaultCategoryId": "..."
    }
    ```
  - Hỗ trợ đọc trực tiếp file `.xlsx` (ZIP/XML), `.csv`/`.tsv`, `.pdf` (bóc tách text/stream từ file PDF) hoặc mảng dòng trích xuất từ client, trả về danh sách `items` chuẩn hóa sẵn `productCode` (IN HOA viết liền), `productName`, `brand`, `color`, `size`, `unit`, `expectedQuantity`, `actualQuantity`, `costPrice`, `sellingPrice`.
- **Hỗ trợ `color` và `size` xuyên suốt các API Kho & POS**:
  - `POST /api/v1/products` & `PATCH /api/v1/products/:id`: Nhận `variants` hoặc `color`, `size`, `quantity`, tự động gộp vào đúng biến thể của mã sản phẩm và tính lại tổng `stockFloor1`, `stockFloor2`, `stock`.
  - `POST /api/v1/imports` & `POST /api/v1/imports/:id/complete`: Mỗi dòng `items[]` có thêm `color`, `size`, `brand`; khi hoàn thành phiếu nhập, các dòng cùng `productCode` nhưng khác `(color, size)` được cộng dồn vào đúng biến thể trong cùng 1 `Product`.
  - `POST /api/v1/inventory/adjustments` & `POST /api/v1/inventory/transfers`: Hỗ trợ truyền `color`, `size` để điều chỉnh hoặc chuyển tầng đúng biến thể.
  - `POST /api/v1/orders` & `POST /api/v1/returns`: Hỗ trợ `color`, `size` trong từng dòng sản phẩm mua/trả/đổi, trừ/cộng tồn Kho Tầng 1 vào đúng biến thể `(color, size)` tương ứng.

### 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*
- `GET /api/v1/printers` — Quét danh sách máy in đang kết nối trên máy trạm/server Windows (ưu tiên tự động nhận diện máy in nhiệt Xprinter / TSC / Godex / Zebra qua cổng USB/LAN).
  - Response:
    ```json
    {
      "data": {
        "printers": [
          {
            "name": "Xprinter XP-350BM",
            "driverName": "Xprinter XP-350BM",
            "portName": "USB001",
            "status": "Normal",
            "isOnline": true,
            "isThermal": true
          }
        ],
        "recommendedPrinter": "Xprinter XP-350BM",
        "platform": "win32"
      },
      "meta": {}
    }
    ```
- `POST /api/v1/printers/print-labels` — Gửi lệnh in tem mã vạch Code128 trực tiếp xuống máy in nhiệt qua Windows Print Spooler (không cần qua hộp thoại trình duyệt hay bị chặn popup). Mã vạch chỉ mã hóa **Mã sản phẩm chung IN HOA VIẾT LIỀN** (`code`).
  - Body:
    ```json
    {
      "printerName": "Xprinter XP-350BM",
      "preset": {
        "id": "70x20_2col",
        "widthMm": 35,
        "heightMm": 20,
        "columns": 2,
        "pageWidthMm": 70,
        "pageHeightMm": 20
      },
      "options": {
        "showShopName": true,
        "showProductName": true,
        "showPrice": true,
        "nameFontSizePx": 0,
        "wrapProductName": true
      },
      "items": [
        {
          "code": "JOGABOLABUBBLEJ",
          "name": "Jogabola BUBBLE J",
          "sellingPrice": 1150000,
          "quantity": 10
        }
      ]
    }
    ```
  - Response:
    ```json
    {
      "data": {
        "printed": true,
        "printerName": "Xprinter XP-350BM",
        "totalStickers": 10,
        "totalPages": 5,
        "message": "Đã gửi lệnh in 10 tem (5 hàng/trang) tới máy in Xprinter XP-350BM thành công."
      },
      "meta": {}
    }
    ```


### 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*
- **Quy tắc sinh Mã Con (`generateVariantProductCode(baseCode, color, size)`)**:
  - Mỗi sản phẩm vẫn giữ 1 **Mã Gốc (`code` / Root Code)** để gom nhóm và đồng bộ **Giá gốc (`costPrice`) / Giá bán (`sellingPrice`)** 1 lần cho toàn bộ các thuộc tính bên trong.
  - Tuy nhiên, mỗi biến thể thuộc tính `(color, size)` bên trong `variants[]` sẽ được cấp một **Mã Con duy nhất (`variantCode` / `barcode`)** theo công thức:
    `[Mã Gốc IN HOA][MÀU IN HOA KHÔNG DẤU VIẾT LIỀN][SIZE IN HOA VIẾT LIỀN]`
    - Ví dụ Mã gốc `GASIA221401`:
      - Màu `Đỏ`, Size `38` -> `variantCode = "GASIA221401DO38"`
      - Màu `Đỏ`, Size `39` -> `variantCode = "GASIA221401DO39"`
      - Màu `Trắng Xanh`, Size `41` -> `variantCode = "GASIA221401TRANGXANH41"`
      - Không màu, chỉ có Size `XL` -> `variantCode = "GASIA221401XL"`
      - Không màu, không size -> `variantCode = "GASIA221401"`
- **Cấu trúc `IProductVariant` trong `Product.variants[]`**:
  ```json
  {
    "variantKey": "DO_38",
    "variantCode": "GASIA221401DO38",
    "barcode": "GASIA221401DO38",
    "color": "Đỏ",
    "size": "38",
    "stockFloor1": 10,
    "stockFloor2": 5,
    "stock": 15
  }
  ```
- **Quy tắc In Tem Nhãn (`BarcodeLabelModal`)**:
  - Khi sản phẩm có thuộc tính (`variants[]` có màu/size), hệ thống **chỉ in theo Mã Con (`variantCode`)** của từng thuộc tính (VD: `GASIA221401DO38`, `GASIA221401DO39`...), kèm tên hiển thị rõ màu & size (VD: `Giày Asia (Đỏ - 38)`), **tuyệt đối không in mã Root chung**.
  - Cho phép bấm in tem cho tất cả các biến thể của sản phẩm hoặc in lẻ từng dòng biến thể (Màu + Size).
- **Quy tắc Quét Mã Vạch (Kiểm kho, Nhập kho & Bán hàng POS)**:
  - **Kiểm kho (CMS & Web)**: Khi bắn Mã Con (VD: `GASIA221401DO38`), hệ thống nhận diện chính xác cả sản phẩm lẫn đúng biến thể `(Đỏ, 38)`, đếm kiểm `+1` vào đúng biến thể đó (`scannedVariantCounts`) và đồng thời cộng vào tổng đã quét của sản phẩm.
  - **Nhập kho (`ImportTab` & `POST /imports/:id/scan-check` / `scan-tag`)**: Mỗi dòng trong phiếu nhập có `variantCode` / `barcode` theo đúng `(productCode, color, size)` của dòng đó. Khi bắn Mã Con, hệ thống khớp thẳng 1-1 vào đúng dòng biến thể mà không bị trùng lặp hay phải bấm phím `1..9` chọn dòng.
  - **Bán hàng POS (`PosTab`)**: Khi bắn Mã Con (VD: `GASIA221401DO38`), hệ thống thêm thẳng `+1` của đúng biến thể `Đỏ - Size 38` vào giỏ hàng POS ngay lập tức, không cần bật Popup hỏi chọn Size/Màu.


### 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*
- **Trường dữ liệu `colorHexes?: string[]`**:
  - Được bổ sung vào `IProductVariant` (`Product.variants[]`) và `IImportReceiptItem` (`ImportReceipt.items[]`).
  - Cho phép lưu 1 hoặc nhiều mã màu Hex (`#RRGGBB`, VD: `["#FFFFFF", "#18181B", "#78350F"]` cho phối màu `White/black coffe`, hoặc `["#16A34A"]` cho `Green`).
- **Đồng bộ xuyên suốt API**:
  - `POST /api/v1/products` & `PATCH /api/v1/products/:id`: Nhận `colorHexes` trên sản phẩm đơn lẻ hoặc từng phần tử trong `variants[]`. Các biến thể cùng tên `color` trong cùng một sản phẩm tự động đồng bộ `colorHexes` với nhau để hiển thị đồng nhất trên khung nhóm màu.
  - `POST /api/v1/imports`, `PUT /api/v1/imports/:id` & `POST /api/v1/imports/:id/complete`: Bảo toàn `colorHexes` của từng dòng hàng nhập kho và tự động cập nhật `colorHexes` vào `Product.variants[]` khi hoàn thành phiếu nhập.
  - Nếu người dùng chỉ nhập tên màu (VD: `White/black coffe`, `Soft oat/vintage khaki`, `Đỏ/Trắng`) mà chưa chọn tay `colorHexes`, hệ thống tự động suy luận danh sách mã màu Hex tương ứng từ tên màu.


### 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)*
- **Vấn đề giải quyết**:
  1. **Chống lem/tràn mã vạch qua tem bên cạnh**: Trên cuộn giấy 2 tem `70×20mm` (`35×20mm`/tem), các mã con quá dài (20–24 ký tự như `PJOGABOLA825539DENDO42`, `PWIKA804147TRANGXANH40`) hoặc thuật toán kéo giãn nhân tạo (`maxDots = 258`, hệ số lẻ `symW = 16..21`) làm dải vạch rộng tới `32–36mm`, tràn qua khe giữa hoặc bị lệch lề cứng (`HardMarginX = 1.25mm` trên driver `Xprinter XP-350B`).
  2. **Chống mất mã khi bóc dán lên sản phẩm**: Khi dải vạch sát mép tem (`< 1mm`), lúc bóc tem khỏi đế và dán lên bề mặt sản phẩm tối màu/cong, vạch Start/Stop ngoài cùng bị thiếu vùng trắng tĩnh (**Quiet Zone** chuẩn ISO/IEC 15417 tối thiểu `>= 10X`, thực tế `>= 3.5mm` mỗi bên) khiến súng quét không đọc được.
- **Quy tắc chuẩn hóa (`toCompactBarcode128(rawCode, maxDots = 200)`)**:
  - Giữ nguyên 100% độ nét nguyên bản `1-bit Pixel-Aligned` ở độ phân giải đầu in nhiệt `203 DPI` (`1 dot = 0.125mm`), **chỉ nhân hệ số nguyên** (`1 dot/module` = `11 dots/symbol` hoặc `2 dots/module` = `22 dots/symbol` khi tổng chiều rộng `<= 184 dots`), tuyệt đối không dùng hệ số lẻ làm biến dạng tỷ lệ vạch/khe trắng.
  - Giới hạn chiều rộng vạch mã tối đa `<= 200 dots` (`<= 25.0mm`) trên vùng tem `34.0mm`, đảm bảo **Quiet Zone trắng tối thiểu `>= 4.0mm` mỗi bên** ngay trên thân tem sau khi bóc dán.
  - Với các `variantCode` có độ rộng Code 128 `> 200 dots`, hàm `toCompactBarcode128` tự động rút gọn tất định phần `[Màu]` (VD: `TRANGXANH -> TX`, `DENDO -> DD`, `WHBCOF -> WBC`, `SOOVK -> SVK`) và nếu cần thiết rút gọn tiền tố `[Hãng]` nhưng luôn bảo toàn **`[Chữ cái đầu Loại SP] + [Tiền tố Hãng] + [6 Số Định Danh SP] + [Mã Màu Rút Gọn] + [Size]`** (VD: `PJOGABOLA825539DENDO42` -> `PJOGAB825539DD42` dài `178 dots = 22.3mm`, giảm `11mm` mà vẫn duy nhất 100%).
- **Bù trừ lề cứng (`HardMarginX / HardMarginY`) & Khóa vùng vẽ (`SetClip`) trên mọi máy in Windows**:
  - Đồng bộ trên cả 4 kênh in (`server/src/utils/windowsPrinter.ts`, `cms/src/app/api/printers/route.ts`, `web/src/app/api/printers/route.ts`, `KetNoiMayInTem-11Sport.bat`) và CSS trình duyệt (`Ctrl+P` trong `BarcodeLabelModal.tsx`):
    - Tem trái: `0.0mm .. 34.0mm` (Tâm `17.0mm`).
    - Khe trắng giữa 2 tem: `34.0mm .. 36.0mm` (`2.0mm` = `16 dots`).
    - Tem phải: `36.0mm .. 70.0mm` (Tâm `53.0mm`).
    - Tự động dịch bù `(-HardMarginX, -HardMarginY)` của GDI+ `.NET PrintDocument` để tọa độ vật lý trùng khớp 100% trên mọi driver (`Xprinter XP-350B`, `XP-350BM`, `XP-365B`, `Gprinter`, `Godex`, `Zebra`, `TSC`...) và khóa `Graphics.SetClip(cellRect)` cho từng tem.
- **Tương thích quét 2 chiều trên mọi máy (`barcodeScanner.ts` & `tagMatch.ts`)**:
  - Khi quét bằng súng mã vạch ở bất kỳ máy nào (Bán hàng POS, Kiểm kho, Nhập kho), hệ thống khớp chính xác 100% cả **Mã đầy đủ (`variantCode`)** lẫn **Mã rút gọn trên tem (`toCompactBarcode128`)** và mẫu đối chiếu `[Cat][BrandPrefix][6Digits][ShortColor][Size]`.



### 2.17 Mua Công Nợ (Mua Trước Trả Sau) Tại Quầy POS & Quản Lý Thu Nợ Trên CMS Dashboard *(v3.5)*
- **Tại quầy POS (`POST /api/v1/orders`, `PUT /api/v1/orders/:id`, `POST /api/v1/orders/:id/confirm`)**:
  - Trong mục **Thanh toán khác (`paymentMethod === "OTHER"`)**, danh sách ghép hình thức thanh toán hỗ trợ thêm **`DEBT` (`Công nợ - Mua trước trả sau`)** bên cạnh `CASH`, `BANKING`, `CARD`.
  - Hỗ trợ truyền kèm:
    - `splitPayments?: { method: "CASH" | "BANKING" | "CARD" | "DEBT"; amount: number }[]`
    - `paidAmount?: number`: Số tiền thực thu ngay tại quầy (`CASH` + `BANKING` + `CARD`).
    - `debtAmount?: number`: Số tiền khách mua công nợ (trả sau).
    - `debtDueDate?: string | null`: Ngày hẹn thanh toán công nợ (`YYYY-MM-DD` hoặc ISO date).
    - `debtNote?: string`: Ghi chú riêng cho khoản công nợ.
  - **Các trường công nợ lưu trên `Order`**:
    - `paidAmount`: Số tiền đã thanh toán lũy kế (`number`, mặc định bằng `totalAmount` nếu đơn không nợ).
    - `debtAmount`: Số tiền công nợ còn lại chưa thanh toán (`number`, mặc định `0`).
    - `initialDebtAmount`: Số tiền công nợ gốc lúc chốt đơn (`number`, mặc định `0`).
    - `debtStatus`: `"NONE" | "UNPAID" | "PARTIAL" | "SETTLED"`
      - `"NONE"`: Đơn thanh toán đủ ngay từ đầu (`initialDebtAmount === 0`).
      - `"UNPAID"`: Đơn nợ 100%, chưa thanh toán đồng nào (`paidAmount === 0 && debtAmount > 0`).
      - `"PARTIAL"`: Khách đã trả trước 1 phần hoặc đã trả nợ 1 phần (`paidAmount > 0 && debtAmount > 0`).
      - `"SETTLED"`: Đơn từng phát sinh công nợ nhưng đã được Admin thu nợ tất toán đủ 100% (`initialDebtAmount > 0 && debtAmount === 0`).
    - `debtDueDate`: Hạn thanh toán công nợ (`Date | null`).
    - `debtPayments`: Mảng lịch sử các lần thu nợ sau khi tạo đơn:
      ```json
      [
        {
          "_id": "...",
          "amount": 500000,
          "method": "CASH | BANKING | CARD",
          "note": "Khách chuyển khoản trả nợ đợt 1",
          "paidAt": "2026-11-04T14:30:00.000Z",
          "collectedBy": "...",
          "collectedByName": "Quản Trị Viên 11Sport"
        }
      ]
      ```
- **Cảnh báo nợ cũ khi tra cứu SĐT khách hàng (`GET /api/v1/customers/lookup?phone=...`)**:
  - Response bổ sung đối tượng `debtSummary`:
    ```json
    {
      "totalDebtAmount": 1500000,
      "unpaidOrdersCount": 2,
      "overdueOrdersCount": 1
    }
    ```
- **API Thu nợ / Tất toán công nợ (`POST /api/v1/orders/:id/debt-payment`)**:
  - **Phân quyền bảo mật**: Chỉ role `ADMIN` (Quản lý trên CMS) được phép thực hiện (`403 FORBIDDEN` nếu role khác).
  - Body:
    ```json
    {
      "amount": 1500000,
      "method": "CASH | BANKING | CARD",
      "note": "Tất toán toàn bộ công nợ"
    }
    ```
  - Quy tắc:
    - Kiểm tra đơn hàng đã chốt (`status !== "DRAFT"`) và đang còn dư nợ (`debtAmount > 0`, nếu bằng 0 trả `400 ORDER_NO_DEBT`).
    - Kiểm tra `0 < amount <= debtAmount` (vượt quá dư nợ trả `400 INVALID_DEBT_PAYMENT_AMOUNT`).
    - Cộng `amount` vào `paidAmount`, trừ `amount` khỏi `debtAmount`, thêm bản ghi vào `debtPayments[]`, và cập nhật `debtStatus` (`"PARTIAL"` nếu `debtAmount > 0`, `"SETTLED"` nếu `debtAmount === 0`).
- **Thống kê & Quản lý Công nợ trên Dashboard CMS (`GET /api/v1/reports/revenue-dashboard`)**:
  - **Doanh thu (`orderRevenue` / `netRevenue`)**: Vẫn ghi nhận đầy đủ giá trị đơn hàng đã xuất bán; đồng thời trong `summary` bổ sung:
    - `collectedRevenue`: Thực thu đã vào quỹ (Tổng giá trị đơn trừ phần đang nợ `outstandingDebtInPeriod`).
    - `outstandingDebtInPeriod`: Tổng công nợ chưa thu của các đơn phát sinh trong kỳ lọc.
    - `initialDebtInPeriod`: Tổng công nợ phát sinh ban đầu trong kỳ lọc.
    - `debtCollectedInPeriod`: Tổng số tiền thu nợ (qua `debtPayments`) phát sinh trong kỳ lọc.
  - Bổ sung khối `debtManagement` trong response của `/reports/revenue-dashboard`:
    - `summary`: `{ totalOutstandingDebt, totalInitialDebt, totalCollectedDebt, activeDebtOrdersCount, settledDebtOrdersCount, activeDebtCustomersCount, overdueDebtAmount, overdueOrdersCount, newDebtInPeriod, collectedInPeriod }`
    - `customers`: Danh sách gom nhóm công nợ theo Khách hàng (`phone`, `customerName`, `totalOrders`, `activeDebtOrders`, `overdueOrders`, `totalOrderAmount`, `totalPaidAmount`, `totalDebtAmount`, `nearestDueDate`, `lastOrderAt`, `orders[]`, `paymentHistory[]`).
    - `orders`: Danh sách chi tiết các đơn hàng có phát sinh công nợ (`initialDebtAmount > 0 || debtAmount > 0`) kèm cờ `isOverdue`, `daysOverdue` để hiển thị cảnh báo đỏ trên CMS.

---

### 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*

#### A. Chấm công (`/attendance`)
- `POST /api/v1/attendance/check-in`
  - Body: `{ "latitude": number, "longitude": number, "clientIp"?: string, "shiftCode"?: "SHIFT_1 | SHIFT_2 | BOTH" }`
  - Headers: `Authorization: Bearer <token>`
  - Logic xác thực:
    - **Đối chiếu lịch phân ca (`ShiftAssignment`) theo ngày**:
      - Nếu nhân viên đã có bản ghi phân ca trong ngày (`shiftAssignmentRepo`):
        - Nếu `shiftCode === "OFF"` (ngày nghỉ theo lịch xếp ca) -> Chặn check-in với lỗi `400 SCHEDULED_DAY_OFF`.
        - Nếu `shiftCode` là `"SHIFT_1"`, `"SHIFT_2"`, hoặc `"BOTH"` (`Ca 1 + Ca 2: 08:30–21:00`): Bắt buộc áp dụng đúng ca đã được phân công (`selectedShift = assignedShift.shiftCode`); nếu client truyền `shiftCode` khác với ca đã xếp -> Trả lỗi `400 SHIFT_MISMATCH`.
      - Chỉ khi chưa có lịch phân ca cho ngày đó: Tự động nhận diện ca làm việc theo giờ bấm Check-in (với `SALES`, nếu không truyền `shiftCode`, gán `SHIFT_1` nếu trước `11:30`, `SHIFT_2` nếu từ `11:30` trở đi; khối `OFFICE` mặc định `SHIFT_1`).
    - Nếu nhân viên (cả khối `OFFICE` và `SALES`) có đơn `WFH` được `HR` duyệt trong ngày hôm nay (kiểm tra hoàn toàn phía server qua `approvedWfh`): Bỏ qua kiểm tra GPS & IP (ghi nhận `checkInType: "WFH"`). Server tuyệt đối không nhận cờ `bypassNetwork` từ client.
    - **Kiểm tra 2 Cơ sở theo cặp (`Location 1 đi với Mạng 1`, `Location 2 đi với Mạng 2`)**:
      - Nếu không có đơn WFH: Vị trí GPS và IP Wi-Fi của nhân viên phải đồng thời khớp với **Cơ sở 1 (`ATTENDANCE_OFFICE_LAT/LNG` + `ATTENDANCE_ALLOWED_IPS`)** HOẶC đồng thời khớp với **Cơ sở 2 (`ATTENDANCE_OFFICE_2_LAT/LNG` + `ATTENDANCE_ALLOWED_IPS_2`)**.
      - Nếu đứng ở Location 1 nhưng dùng Mạng 2 (hoặc ngược lại đứng ở Location 2 nhưng dùng Mạng 1) -> Trả lỗi `400 WIFI_IP_NOT_ALLOWED`. Nếu nằm ngoài bán kính của cả 2 cơ sở -> Trả lỗi `400 LOCATION_OUT_OF_RANGE`.
    - Làm tròn check-in sớm: Nếu check-in trước giờ bắt đầu ca (`08:30` đối với `SHIFT_1` / `BOTH`, hoặc `12:00` đối với `SHIFT_2`), mốc tính công `workStartTime` tự động quy về `08:30` hoặc `12:00`.
  - Response: `{ "data": { "attendance": { "id": "...", "date": "2026-11-05", "shiftCode": "SHIFT_1 | SHIFT_2 | BOTH", "checkInTime": "...", "workStartTime": "...", "status": "ON_TIME | LATE", "lateMinutes": 0, "checkInType": "STANDARD | WFH" } } }`

- `POST /api/v1/attendance/check-out`
  - Body: `{ "forceEarly"?: boolean, "earlyReason"?: string, "lateCheckoutReason"?: string, "latitude"?: number, "longitude"?: number, "clientIp"?: string }`
  - Logic xác thực:
    - Kiểm tra vị trí & mạng 2 cơ sở (`Location 1 + Mạng 1` hoặc `Location 2 + Mạng 2`) tương tự lúc Check-in đối với nhân viên làm việc tại cơ sở (`checkInType !== "WFH"` và không có đơn `WFH` đã duyệt trong ngày; không chấp nhận cờ `bypassNetwork` từ client).
    - Chặn bấm Check-out & Bàn giao ca khi chưa đủ giờ làm việc của ca (`17:30` đối với `SHIFT_1`, `21:00` đối với `SHIFT_2` và `BOTH` `08:30–21:00`), trừ khi nhân viên có đơn xin về sớm (`type: "EARLY"`) đã được `HR` duyệt trong ngày hoặc xác nhận về sớm (`forceEarly = true`).
    - **Kiểm tra Check-out trễ & Tăng ca**:
      - **Làm 2 ca (`BOTH`: `08:30–21:00`)**: Là ca đã ghi trong bảng xếp ca, **không tính là tăng ca** (`overtimeMinutes = 0`).
      - **Khối Bán hàng (`SALES`) làm 1 ca (`SHIFT_1` hoặc `SHIFT_2`)**:
        - Chỉ được phép check-out trễ tối đa **5 phút** sau giờ kết thúc ca (`<= 17:35` với Ca 1, `<= 21:05` với Ca 2).
        - Nếu check-out trễ **quá 5 phút** (`lateCheckoutMinutes > 5`) mà chưa truyền `lateCheckoutReason`: Trả lỗi `400 LATE_CHECKOUT_REASON_REQUIRED` kèm `{ lateCheckoutMinutes }` để giao diện yêu cầu nhân viên nhập lý do vì sao check-out trễ.
        - Khi có `lateCheckoutReason`: Lưu `lateCheckoutMinutes`, `lateCheckoutReason` và đặt `overtimeStatus: "PENDING"` để HR xem xét và quyết định số giờ/phút check-out trễ đó có được tính là tăng ca hay không.
      - **Khối Văn phòng (`OFFICE`)**: Tự check-out muộn sau `17:30` không tự động tính tăng ca; chỉ được tính tăng ca khi **được HR yêu cầu / phê duyệt** (`overtimeStatus: "APPROVED"`).
    - Nếu nhân viên là `SALES` và đã đủ giờ kết ca: Khi bấm nút Pause (Check-out) trên Header mà chưa lập biên bản bàn giao Kho Tầng 1 trong ca, trả `400 HANDOVER_REQUIRED` để giao diện tự động mở popup Bàn giao ca (`ShiftHandoverModal`) mà không cần nút `Bàn giao K1` trên Header. Sau khi gửi biên bản bàn giao, tự động hoàn tất Check-out.
    - Tự động trừ giờ nghỉ trưa: Với nhân viên `OFFICE`, khoảng thời gian `12:00 - 13:00` (1h; ca sáng `08:30 - 12:00`, ca chiều `13:00 - 17:30`) được tự động loại khỏi giờ làm thực tế.
  - Response: `{ "data": { "attendance": { "id": "...", "checkOutTime": "...", "totalWorkHours": 8, "status": "COMPLETED | EARLY_LEAVE", "lateCheckoutMinutes": 0, "lateCheckoutReason": "", "overtimeStatus": "NONE | PENDING | APPROVED | REJECTED", "overtimeApprovedMinutes": 0 } } }`

- `GET /api/v1/attendance/today`
  - Trả về trạng thái chấm công của nhân viên hôm nay, ca được phân công, trạng thái WFH, và thông tin bàn giao ca (nếu là Sales).

- `GET /api/v1/attendance/history`
  - Query: `?month=11&year=2026&staffId=...` (lọc đúng theo tháng/năm nếu truyền).
  - Phân quyền: Nhân viên tự xem lịch sử của mình; `HR` và `ADMIN` xem được của toàn bộ nhân viên.

- `GET /api/v1/attendance/timesheet` (Role `HR` hoặc `ADMIN`) — **Bảng công tháng toàn công ty**
  - Query: `?month=11&year=2026&department=OFFICE|SALES` (tuỳ chọn).
  - Trả về ma trận nhân viên × ngày trong tháng + tổng hợp từng người:
    - `days[]`: `{ date, day, weekday, isToday, holiday?: { name, isOfficialDayOff } }`
    - `rows[]`: `{ staffId, staffCode, staffName, department, role, cells: { [date]: Cell }, summary }`
      - `Cell.code`: `ON_TIME | LATE | EARLY | LATE_EARLY | WFH | WORKING | MISSING_OUT | LEAVE | PAID_LEAVE | ABSENT | HOLIDAY | DAY_OFF | UNSCHEDULED | FUTURE` (`UNSCHEDULED`: dự phòng, hiện không dùng — Sales chưa xếp ca được coi là ngày làm)
      - `Cell` kèm `attendanceId, shiftCode, checkIn, checkOut, hours, lateMinutes, earlyMinutes, isHolidayWork, adjusted, note`.
      - `summary`: `{ standardDays, workUnits (công đi làm quy đổi), holidayPaidDays (công nghỉ lễ chính thức hưởng lương), paidUnits (tổng công tính lương = workUnits + holidayPaidDays), totalHours, lateCount, lateMinutes, earlyCount, earlyMinutes, missingCheckout, absentDays, leaveDays, wfhDays, holidayWorkDays, holidayWorkHours }`
      - `Cell.isPaidHoliday = true` khi là ngày lễ chính thức được nghỉ hưởng nguyên lương.
    - `overview`: `{ totalStaff, workingNow, checkedInToday, lateToday, notCheckedInToday, missingCheckoutMonth, absentMonth }`
    - `monthMeta`: `{ daysInMonth, isLeapYear, sundaysCount, standardDays, officialHolidaysCount, officePaidHolidaysCount }` — thông tin công chuẩn của tháng (1 tuần 6 ngày làm việc: tháng 28 ngày = 24 công; tháng 29 ngày năm nhuận = 24 hoặc 25 công; tháng 30 ngày = 25 hoặc 26 công tuỳ 5 hay 4 Chủ nhật; tháng 31 ngày = 26 hoặc 27 công tuỳ 5 hay 4 Chủ nhật).
  - Quy ước: Giờ chuẩn/ngày `OFFICE` = 8h (`08:30–12:00` và `13:00–17:30`, trừ nghỉ trưa 1h), `SALES` = 9h. Ngày công quy đổi = `min(1, giờ thực tế / giờ chuẩn)`. Ngày làm việc khối `OFFICE` lấy từ `.env` `ATTENDANCE_OFFICE_WORKDAYS` (mặc định `1,2,3,4,5,6` = T2–T7); khối `SALES` theo lịch xếp ca (`OFF` = ngày nghỉ). Công chuẩn tháng (`standardDays`) tính thống nhất theo quy tắc 1 tuần 6 ngày làm việc (`số ngày T2–T7 trong tháng = daysInMonth - sundaysCount`). Ngày nghỉ lễ chính thức không tính vắng; đi làm vào ngày lễ chính thức được đếm `holidayWorkDays` để tính lương lễ.
  - **Ngày lễ chính thức (Điều 112 BLLĐ 2019)**: chỉ lễ có `isOfficialDayOff = true` mới áp dụng; lễ sự kiện/kỷ niệm là ngày làm việc bình thường, không tính công.
    - **Khối Văn phòng**: mọi ngày lễ chính thức rơi vào T2–T7 trong tháng đang xem đều hiển thị `HOLIDAY` (`L`), được nghỉ hưởng nguyên lương và **tự động cộng +1 công** vào `holidayPaidDays` và `paidUnits` (cột `Công`), nằm trong `standardDays` của tháng (không bị chặn bởi ngày tạo bản ghi `createdAt` hay `todayStr`). Nếu bị yêu cầu đi làm → **lương x4** (`holidayWorkDays`, `holidayWorkHours`), không cộng trùng thêm vào `workUnits`.
    - **Khối Bán hàng**: **mặc định không có ngày nghỉ cố định, kể cả Chủ nhật và ngày lễ** — chỉ nghỉ khi xếp ca `OFF` hoặc có đơn nghỉ được duyệt. Mỗi tháng nhân viên Sales có tối đa **4 ngày nghỉ không lương (`OFF`)**. Trong mục **Đăng ký ca tuần**, nhân viên Bán hàng chỉ được chọn nghỉ **tối đa 2 ngày/tuần** (mặc định gồm tối đa **1 ngày OFF không lương** và tối đa **1 ngày phép có lương `PAID_LEAVE`**); nếu muốn nghỉ **từ 3 ngày trở đi trong 1 tuần** thì bắt buộc phải **Tạo đơn xin nghỉ (`LeaveRequest`) tối thiểu trước 3 tuần (21 ngày)**. Ngày lễ là ngày làm bình thường: không cộng công lễ, vẫn nằm trong công chuẩn; đi làm → tính công + **lương x4** (`holidayWorkDays`, `holidayWorkHours`); không đi làm (không có đơn/lịch OFF) → `ABSENT`. Công chuẩn tháng (`standardDays`) tính theo lịch 6 ngày/tuần của tháng (`24`, `25`, `26`, hoặc `27` công tuỳ tháng 28/29/30/31 ngày và số Chủ nhật trong tháng).
    - Lễ trùng Chủ nhật không cộng công thêm.

- `GET /api/v1/attendance/my-calendar` (Mọi nhân viên trừ `ADMIN`) — **Lịch công tháng của chính mình** (Web)
  - Query: `?month=11&year=2026`.
  - Response: `{ "data": { month, year, days[], row (cùng cấu trúc 1 dòng của /attendance/timesheet), rules: { shifts, lateToleranceMinutes, overtimeMinMinutes, holidayWorkPayMultiplier: 4 } } }`
  - Bổ sung cho mỗi `Cell` (cả ở `/attendance/timesheet`): `overtimeMinutes` (số phút tăng ca đã được HR duyệt; ca `BOTH` không tính tăng ca; `SALES` 1 ca chỉ tính khi HR duyệt phần check-out trễ > 5p; `OFFICE` chỉ tính khi được HR yêu cầu), `overtimeStatus` (`NONE | PENDING | APPROVED | REJECTED`), `overtimeApprovedMinutes`, `lateCheckoutMinutes`, `lateCheckoutReason`, `earlyApproved`, `lateApproved` (có đơn xin về sớm / đi trễ đã duyệt), `leaveRequests[]` (`{ id, type, status, reason, reviewNote }` mọi trạng thái).
  - Bổ sung `summary`: `overtimeDays`, `overtimeMinutes`, `pendingRequests`, `paidLeaveEntitled` (tổng số ngày phép có lương khả dụng tích lũy đến tháng đang xem = phép thử việc được cộng + phép các tháng chính thức - phép đã dùng các tháng trước), `paidLeaveFromProbation` (số ngày phép tích lũy từ giai đoạn thử việc: `0 | 1 | 2`), `paidLeaveTotalEarned` (tổng ngày phép tích lũy từ đầu), `paidLeaveUsedTotal` (tổng ngày phép đã dùng từ đầu), `paidLeaveUsed` (số ngày phép dùng trong tháng), `paidLeaveRemaining` (số ngày phép còn lại để dành sang tháng sau), `paidLeaveForfeited` (`0` vì ngày phép được cộng dồn để dành, không bị mất khi qua tháng mới), `salesOffEntitled` (`4` với khối `SALES`, `0` với khối `OFFICE`), `salesOffUsed`, `salesOffRemaining`.
  - `Cell.code = "PAID_LEAVE"`: nghỉ phép có lương đã duyệt → **+1 công/ngày** (cộng toàn bộ `paidLeaveUsed` trong tháng vào `paidUnits`).
  - Đi làm ngày lễ chính thức hiển thị nhãn **x4 lương** (100% lương ngày lễ + ≥ 300% lương làm việc ngày lễ).

- `PATCH /api/v1/attendance/:id` (Role `HR` hoặc `ADMIN`) — **Điều chỉnh giờ công, Chuyển sang OFF/WFH & Xét duyệt tăng ca** (quên check-out, sai giờ, đổi hình thức làm việc trực tiếp/WFH, chuyển ngày đó thành ngày nghỉ OFF/PAID_LEAVE, xét duyệt check-out trễ của Sales hoặc giao tăng ca cho Văn phòng)
  - Body: `{ "checkIn"?: "08:30", "checkOut"?: "17:30", "shiftCode"?: "SHIFT_1|SHIFT_2|BOTH|OFF", "checkInType"?: "STANDARD|WFH", "offType"?: "OFF|PAID_LEAVE", "overtimeStatus"?: "NONE|PENDING|APPROVED|REJECTED", "overtimeApprovedMinutes"?: number, "reason": "string (bắt buộc)" }`
  - Khi `shiftCode = "OFF"`: không yêu cầu `checkIn`/`checkOut`; xoá bản ghi chấm công đi làm của ngày đó, tự động tạo/cập nhật đơn nghỉ đã duyệt (`APPROVED`) loại `offType` (`OFF` nghỉ không lương hoặc `PAID_LEAVE` nghỉ phép có lương cho nhân viên `FULLTIME`), đồng thời đồng bộ lịch phân ca ngày đó về `OFF` (nếu là `SALES` và `offType = "OFF"`).
  - Khi `shiftCode` là `SHIFT_1 | SHIFT_2 | BOTH`: Server tự tính lại `workStartTime`, `lateMinutes`, `earlyMinutes`, `totalWorkHours`, `status`, cập nhật `checkInType` (`STANDARD` hoặc `WFH`), trạng thái & số phút tăng ca (`overtimeStatus`, `overtimeApprovedMinutes`); ghi vết `adjustedBy`, `adjustedByName`, `adjustedAt`, `adjustReason`.

- `POST /api/v1/attendance/manual` (Role `HR` hoặc `ADMIN`) — **Chấm công bù (bao gồm chấm công đi làm trực tiếp, chấm công WFH hoặc chấm OFF)** cho nhân viên
  - Body: `{ "staffId": "...", "date": "2026-11-05", "shiftCode": "SHIFT_1|SHIFT_2|BOTH|OFF", "checkInType"?: "STANDARD|WFH", "offType"?: "OFF|PAID_LEAVE", "checkIn"?: "08:30", "checkOut"?: "17:30", "overtimeStatus"?: "NONE|APPROVED", "overtimeApprovedMinutes"?: number, "reason": "string (bắt buộc)" }`
  - Khi `shiftCode = "OFF"`: không cần truyền `checkIn`/`checkOut`; hệ thống ghi nhận ngày nghỉ (`OFF` không lương hoặc `PAID_LEAVE` có lương cho `FULLTIME`, kiểm tra hạn mức 4 ngày OFF không lương/tháng đối với `SALES` và quỹ ngày phép tích lũy `PAID_LEAVE` đối với `FULLTIME`), xoá bản ghi chấm công nếu đã lỡ tạo trong ngày và đồng bộ `ShiftAssignment` sang `OFF`.
  - Lỗi: `400 ALREADY_CHECKED_IN` nếu ngày đó đã có bản ghi chấm công và `shiftCode !== "OFF"` (dùng PATCH để sửa).

- `GET /api/v1/attendance/config`
  - Trả về cấu hình vị trí GPS và danh sách IP Wi-Fi/LAN công ty (chỉ đọc từ biến môi trường `.env` trên Server: `ATTENDANCE_OFFICE_NAME`, `ATTENDANCE_OFFICE_LAT`, `ATTENDANCE_OFFICE_LNG`, `ATTENDANCE_MAX_DISTANCE_METERS`, `ATTENDANCE_REQUIRE_GPS`, `ATTENDANCE_REQUIRE_IP`, `ATTENDANCE_ALLOWED_IPS`), kèm `detectedClientIp`. Không cho phép chỉnh sửa qua UI/API (HR và Admin đều không được sửa trên giao diện).
  - Response: `{ "data": { "config": { "officeName": "...", "officeLat": 16.0352, "officeLng": 108.2185, "maxDistanceMeters": 50, "allowedIps": ["127.0.0.1", "::1"], "requireGps": true, "requireIp": false }, "detectedClientIp": "127.0.0.1" } }`

#### B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`)
- **Quy trình làm việc & Cơ chế Tích lũy / Cộng dồn Ngày phép (`PAID_LEAVE`)**:
  - Khối `OFFICE`: bắt buộc nghỉ **Chủ nhật** (`ATTENDANCE_OFFICE_WORKDAYS=1,2,3,4,5,6`).
  - Khối `SALES`: mỗi tháng có tối đa **4 ngày nghỉ không lương (`OFF`)**. Trong mục đăng ký ca chỉ được nghỉ tối đa **2 ngày/tuần** (mặc định **1 ngày OFF** + **1 ngày phép**); từ **3 ngày trở đi trong tuần** bắt buộc phải tạo đơn xin nghỉ tối thiểu trước **3 tuần (21 ngày)**.
  - **Hợp đồng Thử việc (`PROBATION`) lên Chính thức (`FULLTIME`) & Cộng dồn Ngày phép**:
    - Giai đoạn Thử việc (`PROBATION`) mặc định tối đa **2 tháng** (có thể ký hợp đồng Chính thức sau **1 tháng**; cấu hình qua `probationMonths: 1 | 2`, `probationStartDate`).
    - Mỗi tháng thử việc vẫn được tích lũy **1 ngày nghỉ phép có lương** (1 tháng thử việc = 1 ngày phép; 2 tháng thử việc = 2 ngày phép; tối đa 2 ngày phép thử việc). Trong thời gian đang Thử việc chưa được dùng ngày phép có lương, nhưng sau khi thử việc xong chuyển sang giai đoạn **Chính thức (`FULLTIME`)** sẽ được **cộng số ngày phép tương đương với số tháng thử việc** (`1` hoặc `2` ngày) VÀ **mỗi tháng chính thức có thêm 1 ngày phép** (`+1 ngày/tháng`).
    - **Để dành & Cộng dồn ngày phép**: Ngày phép có lương (`PAID_LEAVE`, vẫn tính `+1 công` hưởng lương) có thể **để dành lại và cộng dồn** qua các tháng tiếp theo (không bị mất khi hết tháng).
    - **Dùng ngày phép liên tiếp & Tạo đơn trước 3 tuần**: Nhân viên có thể dùng ngày phép cộng dồn liên tiếp tối đa **1 tuần (7 ngày)**, với điều kiện **từ 2 ngày phép trở đi** (trong cùng tuần / đợt nghỉ) hoặc **nghỉ từ 3 ngày trở đi trong 1 tuần** bắt buộc phải **tạo đơn trước tối thiểu 3 tuần (21 ngày)** (`400 ADVANCE_NOTICE_REQUIRED`).
- `POST /api/v1/leave-requests`
  - Tạo đơn (`type: "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE"`), `date`, `reason`.
  - `reason`: bắt buộc, **tối đa 100 ký tự** (sau khi bỏ khoảng trắng đầu/cuối) → vượt quá trả `400 REASON_TOO_LONG`.
  - Cả nhân viên khối `OFFICE` và khối `SALES` đều được phép nộp đơn `WFH` (Làm việc từ xa).
  - `PAID_LEAVE` (Nghỉ phép có lương): chỉ hợp đồng `FULLTIME` (`400 PAID_LEAVE_NOT_ELIGIBLE`); kiểm tra theo **quỹ ngày phép tích lũy** (gồm ngày phép từ giai đoạn thử việc 1–2 tháng + 1 ngày phép/tháng chính thức trừ đi các ngày phép đã dùng/đang chờ duyệt; vượt quá trả `400 PAID_LEAVE_QUOTA_EXCEEDED`). Khi dùng từ **2 ngày phép trở đi** trong tuần (tối đa liên tiếp 1 tuần = 7 ngày), bắt buộc ngày nghỉ phải cách ngày tạo đơn tối thiểu **21 ngày (3 tuần)** (`400 ADVANCE_NOTICE_REQUIRED`).
  - `OFF` = nghỉ không lương (không tính công). Với nhân viên `SALES`: tổng số ngày nghỉ không lương trong tháng (`YYYY-MM`, tính gộp các ngày có lịch phân ca `shiftCode === "OFF"` và các đơn `type === "OFF"` đang chờ duyệt/đã duyệt theo ngày phân biệt, không tính ngày có `PAID_LEAVE` đã duyệt) tối đa **4 ngày/tháng** (`400 SALES_OFF_QUOTA_EXCEEDED`). Nếu xin nghỉ từ **3 ngày trở đi trong 1 tuần** (tổng ngày nghỉ `OFF` + `PAID_LEAVE` trong tuần >= 3 ngày), bắt buộc phải tạo đơn trước tối thiểu **21 ngày (3 tuần)** (`400 ADVANCE_NOTICE_REQUIRED`).
  - Lỗi `400 DUPLICATE_REQUEST` nếu đã có đơn cùng loại, cùng ngày đang chờ duyệt hoặc đã duyệt.
- `GET /api/v1/leave-requests`
  - HR xem danh sách đơn chờ duyệt; nhân viên xem danh sách đơn của mình (sắp xếp ngày mới nhất trước).
- `DELETE /api/v1/leave-requests/:id`
  - Nhân viên tự hủy đơn của mình khi còn `PENDING`. Đơn đã duyệt/từ chối trả `400 REQUEST_ALREADY_REVIEWED`; đơn của người khác trả `403`.
- `PATCH /api/v1/leave-requests/:id`
  - HR duyệt hoặc từ chối đơn: `{ "status": "APPROVED" | "REJECTED", "reviewNote": "string" }`.

#### C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`)
- `POST /api/v1/shifts/preferences`
  - Nhân viên Bán hàng (`SALES`) nộp đăng ký ca tuần tới: `{ "weekStart": "2026-11-09", "preferences": [{ "date": "2026-11-09", "dayOfWeek": 1, "isOffRequested": false, "preferenceShift": "SHIFT_1 | SHIFT_2 | BOTH | OFF", "leaveType"?: "OFF | PAID_LEAVE" }] }`.
  - **Ràng buộc Đăng ký ca**:
    - Bắt buộc gửi đủ 7 ngày của tuần (`weekStart`..`weekStart + 6 ngày`).
    - Trong mục đăng ký ca, nhân viên Bán hàng **không được nghỉ quá 2 ngày trong 1 tuần** (mặc định chỉ được tối đa **1 ngày OFF không lương** và **1 ngày phép có lương `PAID_LEAVE`**).
    - Nếu muốn nghỉ **từ 3 ngày trở đi trong 1 tuần** (hoặc dùng từ 2 ngày phép trở đi), nhân viên bắt buộc phải **Tạo đơn xin nghỉ (`POST /api/v1/leave-requests`) tối thiểu trước 3 tuần (21 ngày)**; chỉ những ngày nghỉ đã có đơn hợp lệ (tạo trước >= 3 tuần) mới được vượt quá mốc 2 ngày/tuần trên lịch ca.
    - Tổng số ngày nghỉ không lương (`OFF`) của nhân viên trong tháng (`YYYY-MM`) không vượt quá **4 ngày/tháng**, và ngày phép `PAID_LEAVE` đăng ký trong ca tuần phải nằm trong quỹ phép tích lũy còn lại. Vi phạm trả `400 WEEKLY_OFF_REQUIRED`, `400 SALES_OFF_QUOTA_EXCEEDED`, hoặc `400 PAID_LEAVE_QUOTA_EXCEEDED`.
  - **Logic xử lý đăng ký 2 ca/ngày (`preferenceShift = "BOTH"`)**:
    - Nếu trong ngày đó cả `Ca 1` và `Ca 2` đều đã có nhân viên khác đăng ký/trực (ca không trống): Hệ thống tự động **random 1 trong 2 ca (`SHIFT_1` hoặc `SHIFT_2`)** cho nhân viên đó.
    - Nếu trong ngày đó có ca bị trống (`Ca 1` hoặc `Ca 2` chưa có ai khác đăng ký): Nhân viên đăng ký 2 ca sẽ được xếp **làm cả 2 ca (`shiftCode = "BOTH"`)**, hiển thị ở cả hàng `Ca 1` và `Ca 2` trên bảng phân ca của HR.
  - Lưu bản ghi `ShiftAssignment` với `assignedBy: "AUTO"`, `preferenceShift`, `isOffRequested`, `seenByStaff: true` để hiển thị ngay trên bảng phân ca tuần của HR. Nếu tuần đó đã được HR chốt (`assignedBy: "HR"`), trả lỗi `400 SCHEDULE_ALREADY_CONFIRMED`.
- `GET /api/v1/shifts/schedule`
  - Xem bảng lịch ca của tuần: `?weekStart=2026-11-09` (lấy toàn bộ phân ca có `date` từ `weekStart` đến `weekStart + 6 ngày`), kèm thống kê số ngày `OFF` không lương trong tháng của từng nhân viên `SALES` (`monthlyOffByStaff`).
- `GET /api/v1/shifts/my-schedule`
  - Query: `?weekStart=2026-11-16` (mặc định Thứ Hai tuần kế tiếp).
  - Trả về lịch ca của chính nhân viên đang đăng nhập cho tuần `weekStart`, kèm `unseenConfirmedCount` (số ca đã được HR xác nhận `assignedBy === "HR"` mà nhân viên chưa xem `seenByStaff === false`), `confirmedWeeks` (danh sách tuần đã được HR chốt) và `monthlyOffQuota` (`{ limit: 4, byMonth: { "YYYY-MM": { used, usedOtherWeeks, remainingForWeek } } }`).
- `POST /api/v1/shifts/my-schedule/seen`
  - Đánh dấu toàn bộ lịch ca đã được HR xác nhận (`assignedBy === "HR"`) của nhân viên đang đăng nhập thành `seenByStaff: true` (tắt chấm đỏ thông báo trên Menu & tab Chấm công).
- `PUT /api/v1/shifts/assign/bulk` (Role `HR` hoặc `ADMIN`) — **Lưu thay đổi & Xác nhận hoàn thành lịch ca tuần** (trên CMS)
  - Body: `{ "weekStart": "2026-11-09", "changes": [{ "staffId": "...", "date": "2026-11-10", "dayOfWeek": 2, "shiftCode": "SHIFT_1 | SHIFT_2 | BOTH | OFF | null" }], "confirmWeek"?: boolean }`
  - `shiftCode = null` → xoá phân ca của nhân viên ngày đó. Mỗi nhân viên chỉ có 1 ca/ngày (ghi đè nếu đã có).
  - Khi `confirmWeek = false` (HR bấm **Lưu nháp**): chỉ lưu thay đổi `shiftCode`, giữ nguyên trạng thái chờ xác nhận (`assignedBy: "AUTO"`, `seenByStaff: true`) của cả nhân viên được chỉnh lẫn các nhân viên khác trong tuần; không khóa sửa đăng ký và chưa bật thông báo cho nhân viên (`confirmed: 0`).
  - Chỉ khi `confirmWeek = true` (HR bấm **Xác nhận & Hoàn tất**): toàn bộ các bản ghi phân ca trong tuần của nhân viên mới được chuyển sang `assignedBy: "HR"`, gắn `confirmedAt: new Date()`, và đặt `seenByStaff: false` để bật **chấm đỏ thông báo** bên giao diện Web của nhân viên Bán hàng.
  - **Ràng buộc 7 ngày/tuần & tối đa 4 ngày nghỉ không lương/tháng**: sau khi áp dụng thay đổi, mỗi nhân viên `SALES` có phân ca trong tuần phải được xếp đủ 7 ngày, trong đó số ngày `OFF` trong tuần từ `0..4` ngày và tổng số ngày nghỉ không lương trong tháng (`YYYY-MM`) không vượt quá **4 ngày/tháng**. Sai → `400 WEEKLY_OFF_REQUIRED`, `fields: { "<tên NV>": "mô tả lỗi" }`, không lưu gì.
  - Response: `{ "data": { "updated": 3, "created": 2, "deleted": 1, "confirmed": 7 } }`
- `POST /api/v1/shifts/auto-assign`
  - HR kích hoạt tự động xếp ca dựa trên preferences Thứ 6: `{ "weekStart": "2026-11-09" }`.
- `PUT /api/v1/shifts/assign`
  - HR kéo - thả (Drag & Drop) hoặc chỉnh sửa phân ca: `{ "shiftAssignmentId": "...", "staffId": "...", "date": "...", "shiftCode": "SHIFT_1 | SHIFT_2" }`.
- `POST /api/v1/shifts/handover`
  - Sales Ca 1 tạo biên bản bàn giao Kho Tầng 1:
    - Body: `{ "cashBalance": 17420000, "discrepancies": [{ "productCode": "GASIA221401DO38", "expected": 10, "actual": 9, "note": "Hàng mẫu trưng bày" }] }`
- `POST /api/v1/shifts/handover/:id/confirm`
  - Sales Ca 2 (đã check-in) bấm xác nhận nhận bàn giao ca: `{ "accept": true, "note": "string" }` -> Mở khóa nút Check-out cho Ca 1.

#### D. Cấu hình Ngày Lễ (`/holidays`)
- `GET /api/v1/holidays`
  - Query: `?year=2026` (mặc định năm hiện tại).
  - Trả về danh sách các ngày lễ trong năm (hợp nhất giữa các ngày lễ công ty trong DB và lịch lễ Việt Nam theo năm từ API công khai `Nager.Date` + bộ lịch Âm - Dương lịch Việt Nam: Tết Dương Lịch, Tết Nguyên Đán, Giỗ Tổ Hùng Vương 10/3 ÂL, 30/4, 1/5, Quốc Khánh 2/9 và các ngày lễ lớn tại Việt Nam).
- `POST /api/v1/holidays/sync-vn` (Role `HR` hoặc `ADMIN`)
  - Body: `{ "year": 2026 }` — Đồng bộ và lưu lịch ngày lễ Việt Nam của năm đó vào DB công ty.
- `POST /api/v1/holidays` (Role `HR` hoặc `ADMIN`)
  - Body: `{ "date": "2026-01-01", "name": "Tết Dương Lịch", "note": "Nghỉ lễ toàn quốc" }`.
- `DELETE /api/v1/holidays/:id` (Role `HR` hoặc `ADMIN`).

#### E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`)
- `GET /api/version` (Next.js App Router endpoint trên `web/` và `cms/`, header `Cache-Control: no-store, no-cache, must-revalidate`)
  - Response: `{ "buildId": "string", "timestamp": "ISO-8601" }`
  - Dùng cho `<VersionChecker />` trên thiết bị di động & máy trạm kiểm tra khi `visibilitychange` / `focus` hoặc định kỳ để hiển thị thanh thông báo cập nhật phiên bản mới.
