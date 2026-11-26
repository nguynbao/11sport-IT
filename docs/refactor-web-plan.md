# Kế hoạch refactor `web/` theo cấu trúc `cms/`

Nhánh: `refactor/web-structure` (tách từ `dev`). Mục tiêu: **không đổi hành vi/UI**, chỉ đổi tổ chức code.

## 1. Hiện trạng

| | `cms/` | `web/` (POS) |
|---|---|---|
| Cấu trúc | `app/`, `config/`, `features/<x>/{components,hooks,api,index.ts,README}`, `shared/{api,hooks,lib,types,ui,utils}` | `app/`, `components/` (phẳng, 26 file), `lib/` (3 file) |
| API | `shared/api/*` + `features/*/api.ts` | `lib/api.ts` 2231 dòng chứa types + utils + auth + gọi API |
| Kiểm soát | `scripts/check-architecture.mjs` (layer, barrel, cycle), vitest, `npm run lint` = tsc + arch | chỉ `next lint`, không test |
| File lớn | page.tsx 190 dòng | `PosTab` 5273, `PosServiceSection` 2265, `BarcodeLabelModal` 1872, `ReturnExchangeTab` 1805, `InventoryTab` 1681, `CameraScannerModal` 1467, `MyAttendanceCalendar` 1384, `page.tsx` 710 |

Trùng lặp với cms (cần gom về `shared/` của web, KHÔNG import chéo giữa hai app): `ThemeToggle`, `VersionChecker`, `ColorSwatchPicker`, `BarcodeLabelModal`, `ProductCodeCreatorModal`, `InvoicePdfModal`, `ContractFilePreviewModal`, `HeaderAttendanceBar`, `MyAttendanceCalendar`, `LeaveRequests`, `barcodeScanner`, các hàm product-code/format trong `api.ts`. File đã bị lệch (md5 khác) nên phải diff từng cái, không copy mù.

## 2. Cấu trúc đích

```
web/
  scripts/check-architecture.mjs   # copy từ cms
  tests/                           # vitest (format, productCode, search…)
  vitest.config.ts
  src/
    app/            # layout, page (mỏng), api routes, _components/, _hooks/useWebShell.ts
    config/         # tabs.ts (TABS_CONFIG), roles.ts
    features/
      pos/          # PosTab, PosShiftBillsSection, ShiftHandoverModal, TagCheck…
      services/     # PosServiceSection
      inventory/    # InventoryTab
      customers/    # CustomerTab
      returns/      # ReturnExchangeTab
      marketing/    # MarketingPushProductsTab
      attendance/   # AttendanceModal, HeaderAttendanceBar, MyAttendanceCalendar, FridayShiftRegistrationModal
      leave/        # LeaveRequests
      account/      # AccountProfileTab
      (mỗi feature: components/ hooks/ api.ts types.ts exports? index.ts README.md)
    shared/
      api/          # client.ts (fetch+token+errors), endpoints.ts, pagination.ts
      types/        # tách từ api.ts: catalog, orders, services, promotions, staff, hrm…
      utils/        # format.ts, productCode*.ts
      lib/          # barcodeScanner.ts, search.ts
      hooks/        # useDebounce, useViewport…
      ui/           # ThemeToggle, VersionChecker, ColorSwatchPicker, Barcode*, ProductCodeCreator, InvoicePdf, ContractPreview, CameraScannerModal, DrawerMenu
```

Quy tắc (giống cms, enforce bằng script): `shared` không import `features/config/app`; `config` không import `app`; feature khác chỉ import qua `@/features/<x>` (barrel `index.ts`); không có vòng phụ thuộc. Alias `@/*` → `./src/*` (thêm vào `web/tsconfig.json` nếu chưa có).

## 3. Các giai đoạn (mỗi giai đoạn = 1 commit, build xanh trước khi sang tiếp)

**P0 – Chuẩn bị baseline** (rủi ro thấp)
- Chạy `npm run build` + `tsc --noEmit` ở `web/` ghi lại kết quả gốc; chụp màn hình các tab POS để so sánh sau.
- Thêm alias `@/`, copy `check-architecture.mjs`, `vitest.config.ts`, script `lint`/`lint:arch`/`test` vào `package.json` (cài `vitest`). Ban đầu để arch-check chạy ở chế độ báo cáo.

**P1 – Tách `lib/api.ts` (2231 dòng)** (rủi ro trung bình)
- Types → `shared/types/*`; hàm format/productCode/barcode → `shared/utils`, `shared/lib`; auth+fetch+`describeApiError` → `shared/api/client.ts`, `errors.ts`.
- Gọi API theo miền → `features/<x>/api.ts`.
- Giữ `lib/api.ts` làm file re-export tạm thời để không vỡ import; xoá ở P5.
- Viết unit test cho format, productCode, search (so với test cms tương ứng).

**P2 – Dời component dùng chung vào `shared/ui`**
- ThemeToggle, VersionChecker, ColorSwatchPicker, BarcodeLabelModal, ProductCodeCreatorModal, InvoicePdfModal, ContractFilePreviewModal, CameraScannerModal, DrawerMenu.
- Diff với bản cms; nếu khác chủ đích POS thì giữ bản web, ghi chú trong README.

**P3 – Dời theo feature (từng feature một, theo thứ tự rủi ro tăng dần)**
`account` → `leave` → `customers` → `marketing` → `attendance` → `returns` → `inventory` → `services` → `pos`.
Mỗi feature: tạo `index.ts` barrel, `README.md`, cập nhật import ở `page.tsx`. Chưa tách logic, chỉ di chuyển file (`git mv` để giữ lịch sử).

**P4 – Tách file khổng lồ thành component + hook** (phần tốn công nhất)
- Mẫu theo cms: `XxxTab.tsx` (container ≤ ~300 dòng) + `hooks/useXxx.ts` (state/handler) + các `components/` con.
- Thứ tự: `ReturnExchangeTab` → `InventoryTab` → `PosServiceSection` → `PosTab` (5273 dòng, chia: giỏ hàng, tìm sản phẩm, thanh toán, khách hàng, ca/quét mã, in hoá đơn).
- Mỗi lần tách 1 khối, build + kiểm thử tay luồng đó.

**P5 – Làm gọn `app/` và config**
- `page.tsx` 710 → ~190 dòng: `TABS_CONFIG` sang `config/tabs.ts`, shell/auth/header/drawer sang `app/_components`, state sang `app/_hooks/useWebShell.ts` (như `CmsAuthGate`, `CmsHeader`, `CmsDrawers`).
- Xoá `lib/api.ts` re-export và thư mục `components/`, `lib/` rỗng.
- Bật arch-check ở chế độ bắt buộc; `npm run lint` = `tsc --noEmit && lint:arch`.

**P6 – Nghiệm thu**
- `npm run lint`, `npm test`, `npm run build` đều xanh.
- QA (agent `tester`) chạy hồi quy: đăng nhập, bán hàng POS (tiền mặt/chuyển khoản/chia thanh toán), dịch vụ, đổi trả, kho, khách hàng, chấm công, nghỉ phép, in tem/hoá đơn, quét camera.
- Cập nhật `docs/status.md`, README tổng.

## 4. Rủi ro & cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Vỡ hành vi POS (bán hàng là luồng sống còn) | Không đổi logic ở P1–P3; mỗi commit nhỏ, build xanh; test tay luồng chính sau P3 và P4 |
| `PosTab` 5k dòng khó tách, state chằng chịt | Tách hook trước, UI sau; mỗi lần 1 khối |
| Vòng phụ thuộc khi dời types/utils | Chạy arch-check sau mỗi bước |
| Bản web/cms lệch nhau | Diff từng file, quyết định theo từng trường hợp; không import chéo app |
| Không có test sẵn ở web | Thêm test util ở P1; QA hồi quy thủ công ở P6 |
| Xung đột với nhánh `dev` đang có người sửa `web/` | Rebase `dev` thường xuyên; làm P3 trong thời gian ngắn |

## 5. Ngoài phạm vi
Không đổi API/`docs/api-contract.md`, không đổi UI/UX, không nâng cấp phiên bản thư viện, không gộp chung code web+cms thành package monorepo (có thể đề xuất sau).

## 6. Ước lượng
P0 0.5 ngày · P1 1 · P2 0.5 · P3 1 · P4 3–4 · P5 0.5 · P6 1 ⇒ khoảng **7–8 ngày công**.
