# Kiến trúc Frontend CMS (`cms/`)

Áp dụng mô hình **Bulletproof React** tách rạch ròi 3 lớp: **App Shell & Config** → **Features** → **Shared**.

## Cấu trúc thư mục

```
cms/
├── scripts/
│   └── check-architecture.mjs    # Kiểm tra phụ thuộc layer, barrel & circular imports
├── tests/                        # Unit tests (Vitest) cho hàm thuần ở shared/ & features/
└── src/
    ├── app/                      # Next.js App Router (shell mỏng & API routes)
    │   ├── api/printers/route.ts # Route mỏng -> gọi shared/lib/printerServer.ts
    │   ├── api/version/route.ts  # Trả buildId cho VersionChecker
    │   └── page.tsx              # Auth gate + sidebar + render module theo role
    ├── config/                   # Cấu hình cấp ứng dụng
    │   ├── menu.ts               # CMS_MENU_ITEMS
    │   └── roles.ts              # CmsModuleType & ROLE_ALLOWED_MODULES
    ├── shared/                   # Toàn bộ thành phần dùng chung đa feature
    │   ├── api/                  # client.ts, errors.ts, localFetch.ts, catalogLookup.ts
    │   ├── types/                # Domain types dùng chung
    │   ├── lib/                  # excel.ts, search.ts, barcodeScanner.ts, exportLabels.ts, printerServer.ts
    │   ├── utils/                # format.ts, productCode.ts
    │   └── ui/                   # ThemeToggle, VersionChecker, ExportExcelButton, BarcodeLabelModal...
    └── features/                 # 10 domain nghiệp vụ theo 1 khuôn mẫu thống nhất
        ├── attendance/
        ├── catalog/
        ├── inventory/
        ├── leave/
        ├── orders/
        ├── promotions/
        ├── reports/
        ├── services/
        ├── shifts/
        └── staff/
```

## Khuôn mẫu chuẩn mỗi `src/features/<feature>/`

- `api.ts`: Các hàm gọi API riêng của feature (qua `@/shared/api/client`).
- `types.ts`: Types/Interfaces nội bộ của feature (nếu có).
- `utils.ts` / `exports.ts`: Hàm thuần và hàm xuất Excel riêng của feature.
- `hooks/`: Custom hooks quản lý state & handler (VD: `useInventoryModule.tsx`, `useRevenueDashboard.ts`).
- `components/`: UI components, tabs và modals của feature.
- `index.ts`: Barrel export duy nhất ra ngoài.
- `README.md`: Mô tả ngắn gọn tiếng Việt.

## Quy tắc phụ thuộc một chiều

- `app/` → `config/`, `features/`, `shared/`
- `features/<A>/` → `shared/` và chỉ import từ feature khác qua barrel `@/features/<B>` (bên trong cùng feature `<A>` dùng relative path `../...` để tránh self-barrel cycle).
- `shared/` **không** được import từ `features/`, `config/`, `app/`.
- Kiểm tra tự động:
  - `npm run lint` (`tsc --noEmit && npm run lint:arch`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
