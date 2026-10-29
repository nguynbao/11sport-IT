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
  - Body: `{ "name": "string", "categoryId": "string", "unit": "Cái | Đôi | Bộ", "sellingPrice": 0 }`
  - Lưu ý: `code` tự sinh từ `()` trong `name` và không được sửa sau khi tạo; `stock` khởi tạo = `0`.
  - `sellingPrice` > 0 chỉ được phép khi người gọi có role `ADMIN` (Quản lý/Admin); role khác gửi `sellingPrice > 0` → `403 SELLING_PRICE_FORBIDDEN`.
- `PATCH /api/v1/products/:id`
  - Body: `{ "name": "string", "categoryId": "string", "unit": "string", "sellingPrice": 250000, "costPrice": 180000 }`
  - Lưu ý: Không cho phép sửa `code` hoặc `stock` trực tiếp.
  - *(v1.1)* Chỉ role `ADMIN` được đổi `sellingPrice` / `costPrice`; role khác → `403 SELLING_PRICE_FORBIDDEN` / `403 COST_PRICE_FORBIDDEN`.
- *(v1.1)* Trường mới của `Product`: `costPrice` (giá gốc / giá nhập gần nhất, VND, số nguyên ≥ 0, mặc định `0`). Được cập nhật tự động khi hoàn thành phiếu nhập kho. Response `GET /products` **ẩn** `costPrice` với role `SALES`.
- `GET /api/v1/inventory/movements`
  - Query: `?productId=...&type=IMPORT|SALE|RETURN|EXCHANGE_IN|EXCHANGE_OUT|ADJUSTMENT&from=...&to=...`
  - Response: Lịch sử sổ kho (`StockMovement`).
- `GET /api/v1/inventory/report`
  - Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=...`
  - Response: Báo cáo kế toán kho theo công thức:
    `closingStock (Tồn cuối kỳ) = openingStock (Tồn đầu kỳ) + importedQty (Nhập trong kỳ) - soldQty (Bán trong kỳ) + adjustedAndReturnedQty (± Điều chỉnh trả/đổi)`
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
- `POST /api/v1/imports/:id/finish-listing`
  - Bước 3 ("Hoàn tất" danh sách dự kiến): chuyển trạng thái từ `DRAFT` sang `CHECKING`.
- `POST /api/v1/imports/:id/scan-check`
  - Bước 4 ("Kiểm tra hàng thực tế" bằng camera/tìm kiếm):
  - Body: `{ "query": "mã hoặc tên hàng trên tag", "actualQuantity"?: 10 }`
  - Đối chiếu với các dòng trong phiếu, trả về dòng khớp hoặc cảnh báo không khớp.
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
