# Bộ Test Case & Kết quả Kiểm thử: Website Bán hàng 11 Sport (`shop/`), Backend (`server/`) & CMS (`cms/`)

- **Mã công việc:** `WEB-24`
- **Tài liệu tham chiếu:**
  - `docs/requirements/web-storefront-v1.md` (`AC-01`..`AC-08`, `BR-01`..`BR-07`)
  - `docs/api-contract.md` (Mục 3 - v6.0)
- **Người thực hiện:** QA/Tester (`tester`)
- **Ngày thực thi:** 2026-11-20
- **Phạm vi kiểm thử thực tế:**
  1. `server/`: Build (`npm run build`) & Vitest (`tests/web-models.test.ts`, `tests/web-storefront-api.test.ts`, `tests/cost-price.test.ts`, `tests/hrm-attendance.test.ts`).
  2. `shop/`: Typecheck (`npx tsc --noEmit`), Lint (`npm run lint`), Production Build (`npm run build`), và kiểm tra tĩnh toàn bộ source `shop/src/app/**/page.tsx`, `middleware.ts`, `sitemap.ts`, `FloatingContactWidget.tsx`, `CartPageClient.tsx`.
  3. `cms/`: Typecheck (`npx tsc --noEmit`), Production Build (`npm run build`), và kiểm tra tĩnh phân quyền `cms/src/app/page.tsx`, `WebManagementModule.tsx`, `WebSeoRedirectTab.tsx`, `WebSettingsTab.tsx`.
  4. **Hạng mục chưa kiểm trên môi trường chạy thật (Staging/Live):** Chưa chạy Playwright E2E live browser và Lighthouse live trên môi trường staging có MongoDB thật (đã ghi rõ trạng thái `CHƯA KIỂM`).

---

## 1. Tóm tắt Kết quả Thực thi (Execution Summary)

| Hạng mục kiểm thử | Lệnh / Phương pháp | Kết quả | Ghi chú |
|---|---|---|---|
| **Backend Build** | `cd server && npm run build` | **PASS** | `tsc` biên dịch sạch, exit code 0 |
| **Backend Web & Regression Tests** | `cd server && npx vitest run tests/web-models.test.ts tests/web-storefront-api.test.ts tests/cost-price.test.ts tests/hrm-attendance.test.ts` | **PASS** | **4/4 files, 31/31 tests passed** (web-models: 2, web-storefront-api: 7, cost-price: 6, hrm-attendance: 16) |
| **Storefront (`shop/`) Build & Lint** | `cd shop && npx tsc --noEmit && npm run lint && npm run build` | **PASS** | 0 ESLint warnings/errors, Next.js 14 build thành công (14/14 static pages + dynamic routes) |
| **CMS (`cms/`) Typecheck & Build** | `cd cms && npx tsc --noEmit && npm run build` | **PASS** | Typecheck + Next.js 14 build thành công (5/5 pages) |
| **Kiểm tra tĩnh SEO / Middleware / Sitemap (`shop/`)** | Kiểm tra code `shop/src/app/**`, `middleware.ts`, `sitemap.ts` | **PASS** | Đã sửa & kiểm thử hồi quy `BUG-05` (`middleware.ts` ↔ `/public/redirects`) và `BUG-06` (`sitemap.ts` ↔ `/public/sitemap-data`); `tsc`, `lint`, `build` đều PASS |
| **Kiểm tra tĩnh UI/UX (`shop/`)** | Kiểm tra `FloatingContactWidget.tsx`, `CartPageClient.tsx`, gradient buttons | **PASS** | Widget né sticky bar (`bottom-[88px]`), giỏ hàng không lặp khối quà tặng, không dùng gradient làm mờ chữ nút |
| **Kiểm tra tĩnh RBAC (`cms/`)** | Kiểm tra `cms/src/app/page.tsx`, `WebManagementModule.tsx`, `WebSeoRedirectTab.tsx`, `WebSettingsTab.tsx` | **PASS** | `WEB_MANAGEMENT` chỉ mở cho `ADMIN` & `CEO`; khóa cấu hình kỹ thuật/Redirect với `CEO` |
| **Live Browser E2E & Lighthouse** | Playwright + Lighthouse trên staging | **CHƯA KIỂM** | Chưa có phiên chạy staging live trong đợt kiểm tra này |

---

## 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)

### Nhóm 1: SEO & HTML Structure (`AC-01`, `BR-06`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-01** | Duy nhất 1 thẻ `<h1>` trên mỗi trang `shop/` | Kiểm tra tất cả file `shop/src/app/**/page.tsx` và component client được render (`/`, `/danh-muc/[slug]`, `/thuong-hieu/[slug]`, `/san-pham/[slug]`, `/tin-tuc`, `/tin-tuc/[slug]`, `/lien-he`, `/[staticSlug]`, `/tim-kiem`, `/gio-hang`, `/checkout`, `/order-success`, `/tai-khoan`, `not-found.tsx`) | Mỗi trang chỉ render đúng **1** thẻ `<h1>` tại một thời điểm | **PASS** | Xác minh trực tiếp trong `shop/src/app/**/page.tsx`, `ProductDetailClient.tsx` (1 `<h1>`), `OrderSuccessClient.tsx` (1 `<h1>` theo từng nhánh trạng thái) |
| **TC-WEB-02** | Canonical URL & Meta `noindex` cho trang giao dịch/riêng tư | Kiểm tra `generateMetadata` / `export const metadata` trên toàn bộ route `shop/src/app/` và `shop/src/lib/seo.ts` | Các trang SEO dùng `buildMetadata` (có `alternates.canonical`); 5 route `/tim-kiem`, `/gio-hang`, `/checkout`, `/order-success`, `/tai-khoan` có `robots: { index: false, ... }` | **PASS** | Đã kiểm tra đủ 14 route trong `shop/src/app/` |
| **TC-WEB-03** | Dữ liệu cấu trúc JSON-LD (`application/ld+json`) | Kiểm tra `<JsonLd>` trên `layout.tsx`, `/danh-muc/[slug]`, `/thuong-hieu/[slug]`, `/san-pham/[slug]`, `/tin-tuc`, `/tin-tuc/[slug]`, `/lien-he`, `/[staticSlug]` | Có `Organization` + `WebSite` ở `layout.tsx`; `BreadcrumbList` ở các trang danh mục/thương hiệu/blog/trang tĩnh; `Product` ở PDP; `Article` ở chi tiết bài viết; `LocalBusiness` ở `/lien-he` | **PASS** | Kiểm tra tĩnh trong `shop/src/app/` và `shop/src/lib/seo.ts` |
| **TC-WEB-04** | Kiểm tra HTTP 200 SSR HTML & Meta thực tế khi chạy live | Curl / Playwright kiểm tra HTML source trả về trên server chạy thật | HTTP 200, `<link rel="canonical">`, `application/ld+json` hợp lệ khi có DB | **CHƯA KIỂM** | Chưa chạy trên môi trường staging live |

---

### Nhóm 2: 301 Redirect & Sitemap (`AC-02`, `BR-06`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-05** | Backend API cung cấp dữ liệu Sitemap & Redirects | Kiểm tra `server/src/routes/publicStorefront.ts` & `cmsWeb.ts` | Có `GET /api/v1/public/sitemap-data` và `GET /api/v1/public/redirects` trả về dữ liệu active | **PASS** | Đã xác minh tại `publicStorefront.ts:918` và `publicStorefront.ts:942` |
| **TC-WEB-06** | `shop/src/middleware.ts` xử lý 301 Redirect động từ CMS | Đọc `shop/src/middleware.ts` và đối chiếu `server/src/routes/publicStorefront.ts` (`/public/redirects`) | Middleware fetch/cache `GET /api/v1/public/redirects` và trả `301` khi truy cập `fromPath` | **PASS** | Đã sửa `BUG-05`: fetch `/public/redirects` (cache 60s, timeout 1.5s), trả `301`/`302` khớp API; `shop/` build & lint PASS |
| **TC-WEB-07** | `shop/src/app/sitemap.ts` sinh Sitemap động theo dữ liệu CMS/DB | Đọc `shop/src/app/sitemap.ts` và đối chiếu `server/src/routes/publicStorefront.ts` (`/public/sitemap-data`) | `sitemap.ts` gọi `GET /api/v1/public/sitemap-data` để xuất URL sản phẩm, danh mục, thương hiệu, bài viết, trang tĩnh | **PASS** | Đã sửa `BUG-06`: fetch `/public/sitemap-data` (`revalidate: 300, tags: ["sitemap"]`), xuất đủ 5 nhóm khớp API; `shop/` build & lint PASS |

---

### Nhóm 3: Đồng bộ & Trừ kho Atomic POS vs Online (`AC-03`, `BR-01`, `BR-02`, `BR-03`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-08** | Trừ kho Atomic khi 2 đơn đặt đồng thời sản phẩm cuối cùng | Chạy Vitest `web-storefront-api.test.ts` (case `AC-03`) | 2 request đồng thời mua biến thể có `stockFloor1 = 1` -> 1 đơn `201`, 1 đơn `409 INSUFFICIENT_STOCK`, `stockFloor1 = 0` (không âm) | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |
| **TC-WEB-09** | Tính giá & khuyến mãi từ DB (`POST /api/v1/public/cart/price`) | Chạy Vitest `web-storefront-api.test.ts` (case `BR-03`) | Server tự tính `rawSubtotal`, `couponDiscount` (`SALE11`), `shippingFee`, `totalAmount` từ DB, không tin giá client | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |
| **TC-WEB-10** | Không hồi quy nghiệp vụ POS, Nhập kho, Giá gốc, HRM cũ | Chạy Vitest `web-models.test.ts`, `cost-price.test.ts`, `hrm-attendance.test.ts` | Toàn bộ test cũ pass, tương thích ngược model `Product`, `Category`, `Brand`, `Order`, `Customer`, `Promotion` | **PASS** | 2 + 6 + 16 = 24/24 tests PASS |

---

### Nhóm 4: Checkout QR & Webhook Idempotency (`AC-04`, `BR-05`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-11** | Tạo đơn QR PayOS & xác thực Webhook chữ ký + Idempotency | Chạy Vitest `web-storefront-api.test.ts` (case `AC-04`) | Webhook sai chữ ký bị chặn (`401`); Webhook hợp lệ lần 1 -> `PAID` + ghi `StockMovement`; Webhook lặp cùng `transactionId` lần 2 -> `200 OK` nhưng không trừ kho / không cộng doanh thu lần 2 | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |

---

### Nhóm 5: Hết hạn giữ chỗ đơn QR 15 phút (`AC-05`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-12** | Giải phóng giữ chỗ đơn QR quá hạn 15 phút | Chạy Vitest `web-storefront-api.test.ts` (case `AC-05`) | Đơn QR `UNPAID` quá `reservedUntil` tự động chuyển `CANCELLED` / `EXPIRED` và hoàn trả số lượng đã giữ vào `stockFloor1` | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |

---

### Nhóm 6: Phân quyền RBAC CMS (`ADMIN`, `CEO`, `SALES`) & AuditLog (`AC-06`, `BR-04`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-13** | Backend RBAC `/api/v1/cms/web/*` & `WebAuditLog` | Chạy Vitest `web-storefront-api.test.ts` (case `AC-06`) | `SALES` nhận `403`; `CEO` duyệt nội dung/bài viết được nhưng sửa cấu hình kỹ thuật hoặc Redirect nhận `403`; `ADMIN` toàn quyền + ghi `WebAuditLog` | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |
| **TC-WEB-14** | CMS UI ẩn tab `WEB_MANAGEMENT` với role ngoài `ADMIN`/`CEO` | Kiểm tra `cms/src/app/page.tsx` (`ROLE_ALLOWED_MODULES`) & `WebManagementModule.tsx` | Chỉ `ADMIN` và `CEO` có `"WEB_MANAGEMENT"` trong `ROLE_ALLOWED_MODULES`; `ACCOUNTANT`, `HR`, `MARKETING`, `SALES` không thấy tab | **PASS** | Đã xác minh trực tiếp trong `cms/src/app/page.tsx:165-210` và `WebManagementModule.tsx:86` |
| **TC-WEB-15** | CMS UI khóa quyền sửa kỹ thuật & 301 Redirect với `CEO` | Kiểm tra `WebSeoRedirectTab.tsx` và `WebSettingsTab.tsx` | Với `role === "CEO"`: ẩn nút thêm/sửa/xóa Redirect + hiển thị `AdminOnlyBadge`; `WebSettingsTab` disable toàn bộ 8 trường kỹ thuật (`onlineStockMode`, `ga4Id`, `gtmId`, `payos*`, `webhookSecret`, `revalidateSecret`) | **PASS** | Đã xác minh trực tiếp trong `WebSeoRedirectTab.tsx` và `WebSettingsTab.tsx` |

---

### Nhóm 7: Bảo mật Public API & Customer OTP / Review (`AC-07`, `BR-05`, `BR-07`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-16** | Public API không lộ `costPrice`, `internalNote`, secret keys | Chạy Vitest `web-storefront-api.test.ts` (case `AC-07`) | `GET /api/v1/public/products`, `/products/:slug`, `/settings` tuyệt đối không chứa `costPrice`, `createdBy`, `internalNote`, `payosApiKey`, `webhookSecret` | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |
| **TC-WEB-17** | Customer OTP Auth & gửi đánh giá sản phẩm (`PENDING`) | Chạy Vitest `web-storefront-api.test.ts` (case `WEB-09 & BR-07`) | Đăng nhập OTP thành công nhận Customer JWT; gửi review mặc định `status: 'PENDING'` chờ duyệt | **PASS** | Đã chạy thực tế và PASS trong `web-storefront-api.test.ts` |

---

### Nhóm 8: Accessibility, Mobile Layout & Hiệu năng Frontend (`AC-08`)

| ID | Tên Test Case | Điều kiện & Bước kiểm tra | Kết quả mong đợi | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|---|
| **TC-WEB-18** | `FloatingContactWidget.tsx` né sticky CTA bar trên mobile | Đọc `shop/src/components/layout/FloatingContactWidget.tsx` | Trên `/san-pham/*` và `/checkout`, widget mobile tự đẩy lên `bottom-[88px]` để không che nút Mua ngay / Thanh toán | **PASS** | Đã xác minh tại `FloatingContactWidget.tsx:13-14, 80-82` |
| **TC-WEB-19** | `CartPageClient.tsx` không lặp khối quà tặng & nút rõ nét | Đọc `CartPageClient.tsx` & grep `bg-gradient` trong `shop/src/` | Chỉ có duy nhất 1 khối `eligibleGifts` ở cột phải; không có button nào dùng gradient làm mờ chữ | **PASS** | Đã xác minh tại `CartPageClient.tsx:249-280` |
| **TC-WEB-20** | Kiểm thử Playwright E2E live & Lighthouse SEO ≥ 90 | Chạy Playwright + Lighthouse trên `shop/` desktop & mobile kết nối DB staging | Contrast WCAG AA ≥ 4.5:1, 0 lỗi JS console, LCP < 2.5s, CLS < 0.1, Lighthouse SEO ≥ 90 | **CHƯA KIỂM** | Chưa chạy trên môi trường staging live |
