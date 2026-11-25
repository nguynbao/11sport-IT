# Cây thư mục các file thay đổi - Tích hợp PayOS (Config-Driven)

> **Mã tài liệu:** `shop/docs/tree/payos-changed-files.md`  
> **Nhiệm vụ:** Tích hợp cổng thanh toán trực tuyến PayOS (VietQR / Thẻ)  
> **Trạng thái:** Hoàn thành (Completed)  

---

## 1. Cây thư mục tổng thể các file tác động

```text
Project/FE_sport/
├── docs/
│   └── api-contract.md                               # [MODIFIED] Bổ sung trường payosOrderCode vào hợp đồng API checkout
│
├── server/
│   ├── .env                                          # [MODIFIED] Cấu hình biến SHOP_URL, CORS_ORIGINS và 3 khóa Demo PayOS
│   ├── .env.example                                  # [MODIFIED] Khai báo mẫu biến môi trường PayOS cho các môi trường khác
│   ├── package.json                                  # [MODIFIED] Thêm dependency @payos/node
│   └── src/
│       ├── models/
│       │   └── Order.ts                              # [MODIFIED] Thêm trường payosOrderCode (số nguyên) & index vào OrderSchema
│       ├── routes/
│       │   └── publicStorefront.ts                   # [MODIFIED] Cập nhật POST /checkout và xác thực Webhook POST /payments/payos/webhook
│       └── services/
│           ├── payos.service.ts                      # [ADDED] Service khởi tạo PayOS SDK, tạo payment link & verify webhook
│           └── webStockAndPricing.ts                 # [MODIFIED] Tích hợp PayOS SDK vào hàm createPayosOrVietQrPayment, fallback VietQR
│
└── shop/
    ├── docs/
    │   ├── plan/
    │   │   ├── payos-integration-plan.md             # [ADDED] Kế hoạch chi tiết, kiến trúc, sequence diagram PayOS
    │   │   └── migration-from-mock-to-live-api.md    # [ADDED] Hướng dẫn chi tiết chuyển từ Mock sang Live API & bàn giao Production
    │   ├── log/
    │   │   └── payos-integration-log.md              # [ADDED] Nhật ký kỹ thuật: trích dẫn code trước/sau & giải thích chi tiết
    │   └── tree/
    │       └── payos-changed-files.md                # [ADDED] File này (cây thư mục theo dõi task)
    └── src/
        ├── app/
        │   └── api/
        │       └── payos/
        │           └── create-payment-link/
        │               └── route.ts                  # [ADDED] API Route sinh link thanh toán PayOS thật từ máy chủ PayOS khi chạy demo
        └── components/
            └── checkout/
                ├── CheckoutClient.tsx                # [MODIFIED] Redirect trực tiếp sang PayOS Gateway khi thanh toán PAYOS
                └── OrderSuccessClient.tsx            # [MODIFIED] Auto-polling 3s, kiểm tra trạng thái ngay khi redirect về, render ảnh QR
```

---

## 2. Chi tiết vai trò từng file

| STT | Đường dẫn file | Thao tác | Mô tả vai trò |
| :---: | :--- | :---: | :--- |
| 1 | `shop/docs/plan/payos-integration-plan.md` | **Tạo mới** | Lưu trữ kế hoạch kiến trúc, luồng Sequence Diagram, ràng buộc `orderCode` số nguyên và phương pháp Config-Driven. |
| 2 | `shop/docs/plan/migration-from-mock-to-live-api.md` | **Tạo mới** | Hướng dẫn từng bước chuyển đổi từ Mock Data FE sang Live API Backend và cấu hình Key thật khi bàn giao. |
| 3 | `shop/docs/log/payos-integration-log.md` | **Tạo mới** | Ghi chép chi tiết AI làm gì, trích dẫn từng block code sửa đổi và giải thích lý do để bảo trì lâu dài. |
| 4 | `shop/docs/tree/payos-changed-files.md` | **Tạo mới** | Cung cấp cái nhìn tổng quan dạng cây thư mục để người quản lý hoặc tester tra cứu nhanh các file đã tác động. |
| 4 | `server/package.json` | **Chỉnh sửa** | Thêm gói thư viện chính thức `@payos/node` (v2.x) hỗ trợ tạo link và verify webhook chuẩn xác. |
| 5 | `server/.env` & `server/.env.example` | **Chỉnh sửa** | Bổ sung `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` và `SHOP_URL`. |
| 6 | `server/src/models/Order.ts` | **Chỉnh sửa** | Thêm trường `payosOrderCode?: number` để liên kết chính xác mã đơn hàng số nguyên của PayOS với đơn hàng trong hệ thống. |
| 7 | `server/src/services/payos.service.ts` | **Tạo mới** | Khởi tạo client PayOS singleton từ `.env`, chuẩn hóa `description` <= 25 ký tự không dấu và xác thực chữ ký Webhook. |
| 8 | `server/src/services/webStockAndPricing.ts` | **Chỉnh sửa** | Gọi PayOS SDK tạo checkout link, chuẩn bị `returnUrl`, `cancelUrl` và giữ cơ chế fallback VietQR tự động. |
| 9 | `server/src/routes/publicStorefront.ts` | **Chỉnh sửa** | Sinh mã số nguyên `payosOrderCode`, lưu vào database, verify chữ ký webhook bằng SDK và cập nhật trạng thái đơn sang `PAID` kèm trừ tồn kho. |
| 10 | `shop/src/components/checkout/CheckoutClient.tsx` | **Chỉnh sửa** | Chuyển hướng trình duyệt khách hàng sang URL cổng thanh toán PayOS nếu chọn phương thức `PAYOS`. |
| 11 | `shop/src/components/checkout/OrderSuccessClient.tsx` | **Chỉnh sửa** | Giảm chu kỳ polling xuống 3 giây, hỗ trợ kiểm tra ngay lập tức khi redirect về từ PayOS và hiển thị ảnh mã QR trực quan. |
| 12 | `docs/api-contract.md` | **Chỉnh sửa** | Đồng bộ tài liệu hợp đồng API với trường `payosOrderCode` mới. |
