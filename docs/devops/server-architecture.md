# Kiến trúc Backend (`server/`)

## Cấu trúc phân tầng (Layered Architecture)

```
server/
├── scripts/
│   ├── check-architecture.mjs   # Kiểm tra phụ thuộc layer & circular imports
│   └── ensure-ocr-data.sh       # Tải eng/vie.traineddata lúc build nếu chưa có
├── src/
│   ├── index.ts                 # Bootstrap ứng dụng
│   ├── app.ts                   # Lắp middleware & mount API router
│   ├── config/                  # env.ts, cors.ts, database.ts, seed.ts, db.ts (facade)
│   ├── middleware/              # auth.ts, security.ts
│   ├── routes/                  # Chỉ khai báo endpoint & role middleware -> gọi controller
│   ├── controllers/             # Nhận req/res, gọi service, set header & status
│   ├── services/                # Toàn bộ nghiệp vụ, không phụ thuộc Express req/res
│   ├── repositories/            # Repository abstraction & MemoryStore fallback
│   ├── models/                  # Mongoose schemas & interfaces
│   ├── infra/                   # Hạ tầng bên ngoài: ocr.ts, windowsPrinter.ts, keepAlive.ts
│   ├── shared/                  # Hàm thuần & types dùng chung (auth, date, errors, productCode, search...)
│   ├── migrations/              # Database migrations
│   └── scripts/                 # CLI mỏng (seedDevData, recodeProductsCli, importPdfInventory, auditProductCodes)
└── tests/                       # 19 integration & unit test suites (Vitest + Supertest)
```

## Quy tắc phụ thuộc một chiều

- `routes -> controllers -> services -> repositories -> models`
- `services` có thể dùng `infra`, `shared`, `config`; **không** import `controllers` hay `routes`.
- `shared` và `infra` **không** import `services`, `controllers`, `routes`, `repositories`.
- Kiểm tra tự động bằng lệnh:
  - `npm run lint` (chạy `tsc --noEmit && npm run lint:arch`)
  - `npm run lint:arch` (chạy `node scripts/check-architecture.mjs`)
