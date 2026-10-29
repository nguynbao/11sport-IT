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
  - Response: `{ "data": { "token": "string", "user": { "_id": "...", "code": "NV001", "username": "sales1", "fullName": "Nguyễn Văn Bán", "role": "SALES | WAREHOUSE | ADMIN", "status": "ACTIVE | LOCKED" } } }`
- `GET /api/v1/staff` — Danh sách nhân viên (CMS)
- `POST /api/v1/staff` — Tạo nhân viên mới (`username`, `password`, `fullName`, `phone`, `role`)
- `PATCH /api/v1/staff/:id` — Cập nhật thông tin, phân quyền (`role`) hoặc khóa/mở khóa tài khoản (`status: "ACTIVE" | "LOCKED"`)

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
  - Response: `{ "data": [...], "meta": { "totalProducts": 12, "totalStock": 350 } }`
- `POST /api/v1/products`
  - Body: `{ "name": "string", "categoryId": "string", "unit": "Cái | Đôi | Bộ", "quantity"?: 0, "sellingPrice": 0, "costPrice": 0, "upsertIfExists"?: boolean }`
  - Lưu ý: `code` tự sinh từ `()` trong `name` và không được sửa sau khi tạo; `stock` khởi tạo = `quantity` (mặc định `0`).
  - *(v1.7)* Khi `ADMIN` truyền `quantity > 0`: tạo sản phẩm với `stock = quantity` và tự động ghi `StockMovement` loại `IMPORT` (`referenceCode: "CMS-NHAP-THANG"`). Nếu `upsertIfExists = true` và mã sản phẩm đã tồn tại, hệ thống cộng dồn `quantity` vào `stock` hiện có (đồng thời cập nhật `costPrice`/`sellingPrice` nếu > 0) và ghi `StockMovement` loại `IMPORT`.
  - `sellingPrice` > 0, `costPrice` > 0 hoặc `quantity` > 0 chỉ được phép khi người gọi có role `ADMIN` (Quản lý/Admin); role khác gửi `sellingPrice > 0` → `403 SELLING_PRICE_FORBIDDEN`, gửi `costPrice > 0` → `403 COST_PRICE_FORBIDDEN`, gửi `quantity > 0` → `403 DIRECT_STOCK_FORBIDDEN`.
- `PATCH /api/v1/products/:id`
  - Body: `{ "name": "string", "categoryId": "string", "unit": "string", "sellingPrice": 250000, "costPrice": 180000, "stock"?: 20, "allowDirectStock"?: boolean }`
  - Lưu ý: Không cho phép sửa `code`. Sửa `stock` trực tiếp mặc định bị chặn (`400 STOCK_DIRECT_EDIT_FORBIDDEN`), trừ khi `ADMIN` gửi kèm `allowDirectStock: true` từ CMS (hệ thống sẽ cập nhật `stock` và tự động ghi `StockMovement` loại `IMPORT` nếu tăng hoặc `ADJUSTMENT` nếu giảm để cân bằng Sổ kho).
  - *(v1.1)* Chỉ role `ADMIN` được đổi `sellingPrice` / `costPrice` / `stock` (`allowDirectStock: true`); role khác → `403 SELLING_PRICE_FORBIDDEN` / `403 COST_PRICE_FORBIDDEN` / `403 DIRECT_STOCK_FORBIDDEN`.
- `DELETE /api/v1/products/:id` *(v1.8)*
  - Chỉ role `ADMIN` được xóa sản phẩm (`403 PRODUCT_DELETE_FORBIDDEN` nếu role khác).
  - Xóa sản phẩm theo `id` và dọn các bút toán `StockMovement` liên quan để Báo cáo tồn kho luôn đồng nhất.
  - Response: `{ "data": { "deleted": true, "_id": "...", "code": "...", "name": "..." }, "meta": {} }`
- *(v1.1 & v1.6)* Trường mới của `Product`: `costPrice` (giá gốc / giá nhập gần nhất, VND, số nguyên ≥ 0, mặc định `0`). Được cập nhật tự động khi hoàn thành phiếu nhập kho hoặc do `ADMIN` cập nhật trên CMS. Response `GET /products`, `GET /inventory/report`, `GET /inventory/movements` **ẩn hoàn toàn** `costPrice` với role `SALES` (Saler chỉ thấy `sellingPrice` và số lượng tồn kho).
- `GET /api/v1/inventory/movements`
  - Query: `?productId=...&type=IMPORT|SALE|RETURN|EXCHANGE_IN|EXCHANGE_OUT|ADJUSTMENT&from=...&to=...`
  - Response: Lịch sử sổ kho (`StockMovement`) kèm `sellingPrice`, `stock` hiện tại và `costPrice` (ẩn `costPrice` nếu role `SALES`).
- `GET /api/v1/inventory/report`
  - Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=...`
  - Response: Báo cáo kế toán kho theo công thức:
    `closingStock (Tồn cuối kỳ) = openingStock (Tồn đầu kỳ) + importedQty (Nhập trong kỳ) - soldQty (Bán trong kỳ) + adjustedAndReturnedQty (± Điều chỉnh trả/đổi)`
    Kèm `sellingPrice` và `costPrice` của từng sản phẩm (ẩn `costPrice` nếu role `SALES`).
- `POST /api/v1/inventory/adjustments`
  - Body: `{ "productId": "string", "quantityChange": -2, "reason": "Kiểm kê lệch phiếu nhập PN-0001" }`
  - Tạo phiếu điều chỉnh kho, cập nhật `stock` sản phẩm và ghi `StockMovement` loại `ADJUSTMENT`.

### 2.4 Nhập kho (`/imports`)
- `GET /api/v1/imports` — Danh sách phiếu nhập kho (`DRAFT`, `CHECKING`, `COMPLETED`)
- `GET /api/v1/imports/:id` — Chi tiết phiếu nhập kho
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
  - *(v1.1)* `costPrice`: **giá gốc (đơn giá nhập)** do thủ kho nhập, VND, số nguyên ≥ 0 (không bắt buộc, mặc định `0`). Giá trị âm/không hợp lệ → `400 INVALID_COST_PRICE`. Thủ kho **không** nhập giá bán; giá bán do Quản lý/Admin cập nhật trên CMS.
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
  - *(v1.1)* Với mỗi dòng xác nhận có `costPrice > 0`: cập nhật `Product.costPrice = costPrice` (giá nhập gần nhất). Sản phẩm tự tạo mới có `costPrice` theo dòng nhập và `sellingPrice = 0` (chờ Quản lý/Admin đặt giá bán).

### 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`)
- `GET /api/v1/customers/lookup?phone=...`
  - Tra cứu khách hàng theo SĐT, trả về thông tin khách hàng và lịch sử đơn hàng + phiếu trả/đổi.
- `GET /api/v1/customers` — Danh sách khách hàng
- `GET /api/v1/orders` — Danh sách đơn hàng (lọc theo `search`, `phone`, `status`, `paymentMethod`)
- `GET /api/v1/orders/:id` — Chi tiết đơn hàng (hoặc tra theo `orderCode` qua `GET /api/v1/orders/by-code/:code`)
- `POST /api/v1/orders`
  - Body:
    ```json
    {
      "customerName": "Trần Minh Khách",
      "customerPhone": "0901234567",
      "paymentMethod": "CASH | BANKING | CARD",
      "hasCardFee": true,
      "note": "Giá đã bao gồm thuế",
      "items": [
        {
          "productId": "...",
          "quantity": 2
        }
      ]
    }
    ```
  - Nghiệp vụ:
    - Kiểm tra sản phẩm có `sellingPrice > 0` và `stock >= quantity`.
    - Tính `lineTotal = unitPrice * quantity`, `subtotal = sum(lineTotal)`.
    - Nếu `paymentMethod === "CARD"` và `hasCardFee === true`: `cardFee = Math.round(subtotal * 0.03)`, ngược lại `cardFee = 0`.
    - `totalAmount = subtotal + cardFee`.
    - Trừ `stock` sản phẩm, ghi `StockMovement` loại `SALE`, cập nhật/tạo `Customer` theo SĐT.

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
          "warehouse": { "importsCreated": 2, "importsCompleted": 1, "unitsScanned": 40, "rowsChecked": 10, "unitsImported": 38, "adjustments": 1 },
          "lastActivityAt": "ISO date | null"
        }],
        "sales": [{ "type": "ORDER|RETURN|EXCHANGE", "at": "...", "staffId": "...", "staffName": "...", "referenceCode": "HD-0001", "customerName": "...", "amount": 350000, "units": 2, "paymentMethod": "CASH", "status": "PAID" }],
        "warehouse": [{ "type": "IMPORT_CREATED|IMPORT_CHECKED|IMPORT_COMPLETED|ADJUSTMENT", "at": "...", "staffId": "...", "staffName": "...", "referenceCode": "PN-0001", "quantity": 10, "detail": "..." }]
      },
      "meta": { "from": "...|null", "to": "...|null" }
    }
    ```
  - Nguồn dữ liệu: đơn hàng (`createdBy`), phiếu trả/đổi (`performedBy`), phiếu nhập (`createdBy`, `completedBy`, `items[].scanCounts`), sổ kho loại `ADJUSTMENT` (`performedBy`). Thao tác không gắn được với nhân viên nào được gom vào dòng "Không xác định" (`staffId = ""`).
