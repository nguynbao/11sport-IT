# 11Sport Web (POS & Kho vận)

Ứng dụng cho nhân viên tại quầy: bán hàng, khách hàng, trả/đổi hàng, kiểm kho & quét mã vạch/OCR, in tem, hóa đơn, chấm công, nghỉ phép, tài khoản.

**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Vitest. Port mặc định `3000`.

## Cấu trúc

```text
web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx, page.tsx, globals.css
│   │   ├── _components/          # Shell: Header, BottomNavbar, Drawers, AuthGate, ChangePasswordModal
│   │   ├── _hooks/               # useWebShell
│   │   └── api/                  # Route handlers: printers, version, wise-rate
│   ├── config/                   # listing, roles, tabs
│   ├── features/                 # Module theo nghiệp vụ (components / hooks / api / types)
│   │   ├── pos/                  # Bán hàng tại quầy
│   │   ├── customers/            # Khách hàng
│   │   ├── returns/              # Trả/đổi hàng
│   │   ├── inventory/            # Kho, kiểm hàng
│   │   ├── services/             # Dịch vụ đi kèm
│   │   ├── marketing/            # Khuyến mãi
│   │   ├── attendance/           # Chấm công
│   │   ├── leave/                # Nghỉ phép
│   │   └── account/              # Tài khoản
│   └── shared/
│       ├── api/                  # HTTP client, endpoints, pagination, errors
│       ├── hooks/                # useDebounce, usePagedList, usePullToRefresh, ...
│       ├── lib/                  # Quét/so khớp mã vạch, search
│       ├── types/                # Kiểu dữ liệu dùng chung
│       ├── ui/                   # Component UI chung (barcode, camera scanner, ...)
│       └── utils/                # Tiện ích format, mã sản phẩm, ...
├── public/                       # Tài nguyên tĩnh
├── scripts/                      # check-architecture.mjs
├── tests/                        # Test Vitest (format, pagination, productCode)
└── next.config.mjs, tailwind.config.js, tsconfig.json
```

## Cài đặt & chạy

```bash
cd web
npm install
npm run dev     # http://localhost:3000
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
