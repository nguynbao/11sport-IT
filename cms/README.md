# 11Sport CMS (Quản trị)

Trang quản trị cho quản lý/chủ cửa hàng: dashboard doanh thu, báo cáo & xuất Excel, danh mục/sản phẩm, tồn kho, đơn hàng & trả hàng, công nợ, khuyến mãi, dịch vụ, ca làm, chấm công, nghỉ phép và nhân viên.

**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Vitest. Port mặc định `3001`.

## Cấu trúc

```text
cms/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx, page.tsx, globals.css
│   │   ├── _components/          # CmsHeader, CmsDrawers, CmsAuthGate, CmsChangePasswordModal
│   │   ├── _hooks/               # useCmsShell.ts
│   │   └── api/                  # Route handlers: printers, version
│   ├── config/                   # listing, menu, roles
│   ├── features/                 # Module theo nghiệp vụ (components / hooks / api / index)
│   │   ├── catalog/              # Danh mục, thương hiệu, sản phẩm
│   │   ├── inventory/            # Tồn kho, nhập hàng
│   │   ├── orders/               # Đơn hàng, trả/đổi, công nợ
│   │   ├── promotions/           # Khuyến mãi
│   │   ├── services/             # Dịch vụ
│   │   ├── reports/              # Báo cáo, dashboard
│   │   ├── shifts/               # Ca làm
│   │   ├── attendance/           # Chấm công
│   │   ├── leave/                # Nghỉ phép
│   │   └── staff/                # Nhân viên
│   └── shared/
│       ├── api/                  # HTTP client, endpoints
│       ├── hooks/                # Hook dùng chung (phân trang, debounce, ...)
│       ├── lib/                  # Thư viện hỗ trợ
│       ├── types/                # Kiểu dữ liệu dùng chung
│       ├── ui/                   # Component UI chung
│       └── utils/                # Format, mã sản phẩm, ...
├── public/                       # Tài nguyên tĩnh
├── scripts/                      # check-architecture.mjs
├── tests/                        # Test Vitest (format, pagination, productCode, reportsUtils)
└── next.config.mjs, tailwind.config.js, tsconfig.json
```

## Cài đặt & chạy

```bash
cd cms
npm install
npm run dev     # http://localhost:3001
```

`.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_CMS_URL=http://localhost:3001
```

## Lệnh

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy dev |
| `npm run build` / `npm start` | Build / chạy production |
| `npm test` | Chạy test |
| `npm run lint` | `tsc --noEmit` + kiểm tra kiến trúc |
