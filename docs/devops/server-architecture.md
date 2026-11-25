# Kiến trúc Backend (`server/`)

## Cấu trúc phân tầng (Layered Architecture)

```
server/
├── scripts/
│   ├── check-architecture.mjs   # Kiểm tra phụ thuộc layer, rules thuần & circular imports
│   ├── dump-routes.mjs          # Kiểm tra 108 API routes khớp baseline
│   └── ensure-ocr-data.sh       # Tải eng/vie.traineddata lúc build nếu chưa có
├── src/
│   ├── index.ts                 # Bootstrap ứng dụng
│   ├── app.ts                   # Lắp middleware & mount API router
│   ├── config/                  # env.ts, cors.ts, database.ts, seed.ts, db.ts (facade)
│   ├── middleware/              # auth.ts, security.ts
│   ├── routes/                  # Chỉ khai báo endpoint & role middleware -> gọi controller
│   ├── controllers/             # Dùng handle() từ shared/http để bọc req/res <-> ServiceResult
│   ├── services/                # 18 domain folders, trả về ServiceResult (ok/created/raw)
│   │   ├── attendance/          # Chấm công vào/ra ca & đồng bộ máy chấm công
│   │   ├── auth/                # Đăng nhập, mật khẩu, thông tin tài khoản
│   │   ├── catalog/             # Danh mục, thương hiệu, danh mục chi phí
│   │   ├── handover/            # Bàn giao ca & lịch sử dòng tiền
│   │   ├── holidays/            # Cấu hình ngày lễ
│   │   ├── imports/             # Phiếu nhập hàng, PDF/OCR import
│   │   ├── integrations/        # Máy in tem nhiệt Windows & Wise API
│   │   ├── inventory/           # Tồn kho theo tầng, chuyển tầng, điều chỉnh & lịch sử kho
│   │   ├── leave/               # Đơn xin nghỉ phép
│   │   ├── orders/              # Bán hàng POS, đơn nháp, công nợ khách hàng
│   │   ├── products/            # Quản lý sản phẩm, mã hàng & giá vốn
│   │   ├── promotions/          # Chương trình khuyến mãi & tặng kèm
│   │   ├── reports/             # Báo cáo doanh thu, hoạt động nhân viên & SP cần đẩy
│   │   ├── returns/             # Trả hàng & đổi hàng
│   │   ├── service-orders/      # Đơn dịch vụ (căng vợt, sửa chữa) & loại dịch vụ
│   │   ├── shifts/              # Ca làm việc, phân ca, đổi ca & tăng ca
│   │   ├── staff/               # Nhân sự & import danh sách nhân viên
│   │   └── timesheet/           # Bảng chấm công & tính công
│   ├── repositories/            # Repository abstraction & MemoryStore fallback
│   ├── models/                  # Mongoose schemas & interfaces
│   ├── infra/                   # Hạ tầng bên ngoài: ocr.ts, windowsPrinter.ts, keepAlive.ts
│   ├── shared/                  # Hàm thuần & helpers dùng chung (result, http, auth, errors, search...)
│   ├── migrations/              # Database migrations
│   └── scripts/                 # CLI mỏng (seedDevData, recodeProductsCli, importPdfInventory, auditProductCodes)
└── tests/                       # 19 integration & unit test suites (Vitest + Supertest)
```

## Quy ước trong mỗi domain (`services/<domain>/`)

- `index.ts`: Barrel export duy nhất cho domain; import chéo giữa các domain chỉ đi qua barrel (`../<domain>`).
- `README.md`: Mô tả ngắn trách nhiệm các file trong domain.
- `*.rules.ts`: Logic nghiệp vụ thuần (tính toán, validate, hằng số); **không** import `repositories/`, `models/`, `config/`, `infra/` hoặc Express.
- `*.service.ts` / `*.report.ts`: Orchestration nghiệp vụ, trả về `ServiceResult` qua `ok()`, `created()`, hoặc `raw()` từ `shared/result.ts`. Không phụ thuộc `express` `Request`/`Response`.

## Quy tắc phụ thuộc một chiều

- `routes -> controllers -> services -> repositories -> models`
- `services` có thể dùng `infra`, `shared`, `config`; **không** import `controllers` hay `routes`.
- `shared` và `infra` **không** import `services`, `controllers`, `routes`, `repositories`.
- Kiểm tra tự động:
  - `npm run lint` (`tsc --noEmit && npm run lint:arch`)
  - `npm run lint:arch` (`node scripts/check-architecture.mjs`)
  - `npm run routes:check` (`node scripts/dump-routes.mjs --check`)
