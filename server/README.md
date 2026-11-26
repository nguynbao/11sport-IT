# 11Sport Server

Backend REST API (`/api/v1`) của 11Sport: xử lý nghiệp vụ đơn hàng, sản phẩm, kho, trả/đổi hàng, khuyến mãi, dịch vụ, chấm công, ca làm, nghỉ phép, báo cáo, OCR kiểm hàng và tích hợp Wise.

**Stack:** Node.js, Express, TypeScript, Mongoose (MongoDB), Vitest. Port mặc định `4000`.

## Cấu trúc

```text
server/
├── src/
│   ├── index.ts, app.ts          # Khởi tạo server & ứng dụng Express
│   ├── config/                   # env, CORS, kết nối DB, seed
│   ├── routes/                   # Khai báo router theo module (attendance, orders, returns, imports, promotions, reports, shifts, wise, ...)
│   ├── controllers/              # Nhận request, gọi service, trả response
│   ├── services/                 # Nghiệp vụ theo miền: attendance, auth, catalog, handover, holidays,
│   │                             #   imports, integrations, inventory, leave, orders, products, promotions,
│   │                             #   reports, returns, service-orders, shifts, staff, timesheet
│   ├── repositories/             # Lớp truy cập dữ liệu (base repository)
│   ├── models/                   # Mongoose schemas (Order, Product, Customer, Staff, StockMovement, ...)
│   ├── middleware/               # Xác thực (auth) & bảo mật
│   ├── infra/                    # Hạ tầng: OCR, máy in Windows, keep-alive
│   ├── shared/                   # Tiện ích dùng chung: date, errors, pagination, search, productCode, ...
│   ├── migrations/               # CLI & runner migration MongoDB (scripts/ chứa từng migration)
│   └── scripts/                  # Seed dev, import tồn kho PDF, recode/audit mã sản phẩm
├── scripts/                      # check-architecture, dump-routes (routes baseline), ensure-ocr-data
├── tests/                        # Test Vitest (API, đơn hàng, trả hàng, chấm công, khuyến mãi, OCR, ...)
├── package.json
└── tsconfig.json
```

Luồng: `routes` → `controllers` → `services` → `repositories` → `models`.

## Cài đặt & chạy

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

## Lệnh thường dùng

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy dev (TZ `Asia/Ho_Chi_Minh`, hot reload) |
| `npm run build` | Tải dữ liệu OCR & biên dịch TypeScript ra `dist/` |
| `npm start` | Chạy bản build |
| `npm run start:migrate` | Chạy migration production rồi khởi động server |
| `npm run migrate` | CLI migration (dev) |
| `npm run seed:dev` | Import tồn kho PDF & seed dữ liệu dev |
| `npm run seed:accounts` | Seed tài khoản demo |
| `npm run recode:products` | Đánh lại mã sản phẩm |
| `npm test` | Chạy test |
| `npm run lint` | `tsc --noEmit` + kiểm tra kiến trúc |
| `npm run routes:check` | So sánh routes với baseline |

## Biến môi trường (`.env`)

- `PORT`, `TZ` (`Asia/Ho_Chi_Minh`), `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TAG_MODELS` — OCR Gemini Vision (trống → `tesseract.js`)
- `WISE_API_TOKEN`, `WISE_API_BASE_URL`, `WISE_PROFILE_ID` — Wise API
- `ATTENDANCE_*` — kiểm tra IP/DDNS chấm công

Hợp đồng API: [`../docs/api-contract.md`](../docs/api-contract.md).
