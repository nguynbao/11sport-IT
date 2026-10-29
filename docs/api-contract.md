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
- `PATCH /api/v1/products/:id`
  - Body: `{ "name": "string", "categoryId": "string", "unit": "string", "sellingPrice": 250000 }`
  - Lưu ý: Không cho phép sửa `code` hoặc `stock` trực tiếp.
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
  - Body: `{ "imageText"?: "string", "sampleType"?: "string" }`
  - Trích xuất dữ liệu camera/OCR thành danh sách 6 cột (`stt`, `productCode`, `productName`, `unit`, `expectedQuantity`, `note`) để người dùng xem lại và chỉnh sửa.
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
          "note": "",
          "isChecked": false,
          "isConfirmed": false,
          "discrepancyNote": ""
        }
      ]
    }
    ```
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
