# Graph Report - Pickball  (2026-11-23)

## Corpus Check
- 317 files · ~722,889 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 5, .example 4, .css 3)

## Summary
- 3194 nodes · 7801 edges · 134 communities (124 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 126 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1e135f55`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ref_react
- cms/src/lib/api.ts
- cms/src/app/page.tsx
- customerAuth.ts
- web/src/lib/api.ts
- app.ts
- ShiftScheduleModule.tsx
- PosTab.tsx
- web/src/components/MyAttendanceCalendar.tsx
- [staticSlug]/page.tsx
- web-models.test.ts
- productCode.ts
- exports.ts
- returns.ts
- shop/package.json
- PikPro Pickleball — Design System, Component Library & Enterprise Next.js Architecture Spec
- services.ts
- Components
- ApiError
- Screen Evidence
- lib/storefront.ts
- StaffModule.tsx
- cms/package.json
- cms/src/components/MyAttendanceCalendar.tsx
- 2. Wireframe & Spec Storefront (`shop/`)
- ordersCustomers.ts
- web/package.json
- web/src/lib/barcodeScanner.ts
- web/src/app/page.tsx
- Header.tsx
- tin-tuc/[slug]/page.tsx
- seo.ts
- recodeProducts.ts
- server/package.json
- runner.ts
- db.ts
- web/src/components/HeaderAttendanceBar.tsx
- AttendanceTimesheetModule.tsx
- cms/src/components/BarcodeLabelModal.tsx
- isMockApiEnabled
- ocr.ts
- PosServiceSection.tsx
- Order.ts
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- shifts.ts
- attendance.ts
- attendanceTimesheet.ts
- promotions.ts
- imports.ts
- Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)
- ReturnExchange.ts
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- CameraScannerModal.tsx
- normalizeToCompactUpperCode
- leaveRequests.ts
- staffImportParser.ts
- ref_lucide_react
- compilerOptions
- Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0
- Repository
- compilerOptions
- HrmAttendanceModule.tsx
- compilerOptions
- excel.ts
- StockMovement
- windowsPrinter.ts
- Layout
- TagCheckScannerModal.tsx
- pickleball Design System
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- express
- services
- web
- compilerOptions
- Milestone 1: Figma Design System & Dedicated Storefront Components (`pickleball`)
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- volumes
- environment
- web/src/app/layout.tsx
- server
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- 2. Đặc tả Chi tiết Các Màn hình & Wireframe
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- InventoryTab.tsx
- 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)
- ref_next
- ShiftAssignment
- index.ts
- healthcheck
- ImportReceipt.ts
- WiseCalculatorStash.tsx
- cms
- mongodb
- shop
- Kế hoạch: Website bán hàng tham chiếu mipik.vn (Next.js, SEO) + CMS Quản trị Web
- shop/src/app/page.tsx
- format.ts
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS
- Attendance.ts
- middleware.ts
- Dự án bán hàng 11 Sport
- Dự án bán hàng 11 Sport
- next
- Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)
- Design System - 11Sport (POS, Kho & CMS)
- Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)
- cms/src/app/layout.tsx
- Migration DB — 11 Sport
- Skill GitHub gợi ý cho từng phòng ban
- .eslintrc.json
- pre-commit-graphify.sh
- ref_path
- start-dev.sh
- REA Baseline — `https://mipik.vn/` Reverse-Engineering Summary
- ShiftHandover.ts
- Variable Colors
- Styles
- 4. Quy tắc nghiệp vụ (Business Rules)
- orderLock.ts
- middleware/auth.ts
- Do's and Don'ts
- Shapes
- Variables
- Centralized Mock Data Vault & Mock API Router (`shop/src/data/mock/`)

## God Nodes (most connected - your core abstractions)
1. `Components` - 141 edges
2. `ApiError` - 75 edges
3. `apiRequest()` - 65 edges
4. `normalizeToCompactUpperCode()` - 52 edges
5. `Screen Evidence` - 45 edges
6. `InventoryModule()` - 37 edges
7. `PosTab()` - 36 edges
8. `mongoose` - 35 edges
9. `createApp()` - 32 edges
10. `formatVND()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `D. Giỏ hàng, Checkout, Thanh toán PayOS/VietQR & Tra cứu đơn` --references--> `StockMovement`  [INFERRED]
  docs/api-contract.md → cms/src/lib/api.ts
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/lib/api.ts
- `3.2 Kế toán Kho & Sổ kho (Stock Movement)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `3.3 Nhập kho (Import Receipt)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts

## Import Cycles
- None detected.

## Communities (134 total, 10 thin omitted)

### Community 0 - "ref_react"
Cohesion: 0.10
Nodes (63): WebAuditLogsTab(), STATUS_BADGE, WebBannersTab(), SubMode, WebCatalogTab(), ContentMode, STATUS_BADGE, WebContentTab() (+55 more)

### Community 1 - "cms/src/lib/api.ts"
Cohesion: 0.04
Nodes (73): DEFAULT_WEEKLY_SCHEDULE, getMonthStartStr(), localDateStr(), ShiftHandoverModule(), shiftLabel(), WEEKDAY_LABELS, buildCompactColorTokenFE(), confirmShiftHandoverApi() (+65 more)

### Community 2 - "cms/src/app/page.tsx"
Cohesion: 0.06
Nodes (63): CMS_MENU_ITEMS, CmsDashboardPage(), CmsModuleType, ROLE_ALLOWED_MODULES, AccountProfileModule(), AccountProfileModuleProps, getRoleDisplayName(), toIsoDateSlice() (+55 more)

### Community 3 - "customerAuth.ts"
Cohesion: 0.21
Nodes (13): attachCustomerContext(), base64UrlDecode(), base64UrlEncode(), CustomerTokenPayload, dispatchCustomerOtp(), Express, generateOtpCode(), getCustomerJwtSecret() (+5 more)

### Community 4 - "web/src/lib/api.ts"
Cohesion: 0.05
Nodes (55): buildCompactColorTokenFE(), ContractType, CurrentShiftOrdersSummary, DailyHandoverCategoryInfo, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, Department (+47 more)

### Community 5 - "app.ts"
Cohesion: 0.11
Nodes (39): An toàn DB, supertest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), getDbMode(), importReceiptRepo (+31 more)

### Community 6 - "ShiftScheduleModule.tsx"
Cohesion: 0.18
Nodes (16): addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf(), mondayOf(), pad(), ROWS (+8 more)

### Community 7 - "PosTab.tsx"
Cohesion: 0.13
Nodes (30): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+22 more)

### Community 8 - "web/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.09
Nodes (39): CONTRACT_LABEL, fmtDate(), isPaidLeaveEligible(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, LeaveRequestModal(), MyLeaveRequestsPanel() (+31 more)

### Community 9 - "[staticSlug]/page.tsx"
Cohesion: 0.09
Nodes (55): 1. Bảng Đối Chiếu Toàn Bộ 18 Nhóm Routes (`shop/src/app/`) — 18/18 `[x]`, 5.2 Strict Design System Reuse Rule ("Không Được Mỗi Trang Mỗi Kiểu"), generateMetadata(), getParam(), ShopAllPage(), ShopAllPageProps, generateMetadata(), getParam() (+47 more)

### Community 10 - "web-models.test.ts"
Cohesion: 0.03
Nodes (81): mongoose, CollectionRecord, BrandModel, BrandSchema, BrandStatus, IBrand, CategoryModel, CategorySchema (+73 more)

### Community 11 - "productCode.ts"
Cohesion: 0.11
Nodes (34): assignCategorySkuCodes(), brandTerms(), buildBrandSeedList(), EXTRA_ALIASES, findBrandExact(), findTermIndex(), knownBrandCandidates(), matchBrandInText() (+26 more)

### Community 12 - "exports.ts"
Cohesion: 0.11
Nodes (42): ROLE_LABEL, toInputDate(), ViewTab, DailyRevenueTrend, formatVariantLabel(), RevenueByCategory, SalesActivity, StaffActivityReport (+34 more)

### Community 13 - "returns.ts"
Cohesion: 0.18
Nodes (30): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), WarehouseFloor, applyPaidOrderSideEffects(), prepareOrderData(), prepareReturnExchangeCalculation(), returnsRouter, buildVariantKey(), buildVariantSku() (+22 more)

### Community 14 - "shop/package.json"
Cohesion: 0.04
Nodes (46): embla-carousel-autoplay, eslint, eslint-config-next, zod, dependencies, embla-carousel-autoplay, embla-carousel-react, framer-motion (+38 more)

### Community 15 - "PikPro Pickleball — Design System, Component Library & Enterprise Next.js Architecture Spec"
Cohesion: 0.12
Nodes (15): 2. Goals, Non-Goals & Anti-Goals, 3.1 Reqwise Base Design System Plan (Exact Reproducible Brief), 3.2 Storefront-Specific Semantic Variables (Added to File `pickleball`), 3.3 Dedicated Storefront Component Library (`20` Components in Figma), 3.4 Milestone 1 Verification Gate, 3. Milestone 1 — Figma Design System & Dedicated Component Library (`pickleball`), 4.2 Enterprise Layered Directory Tree, 4. Milestone 2 — Enterprise Next.js Architecture (`d:\Pickball`) (+7 more)

### Community 16 - "services.ts"
Cohesion: 0.05
Nodes (39): serviceOrderRepo, serviceTypeRepo, IServiceOrder, IServiceOrderItem, IServicePaymentRecord, ServiceDiscountType, ServiceOrderItemSchema, ServiceOrderModel (+31 more)

### Community 17 - "Components"
Cohesion: 0.01
Nodes (141): Atom/Avatar, Atom/Status/Badge, Badge container, Badge container 2, Components, Flickity button, Flickity button 2, Flickity page dots (+133 more)

### Community 18 - "ApiError"
Cohesion: 0.09
Nodes (45): assertUniqueName(), brandsRouter, brandUsage(), cleanAliases(), countProductsByBrand(), ensureSystemBrand(), requireBrandManager(), validateCategoryIds() (+37 more)

### Community 19 - "Screen Evidence"
Cohesion: 0.04
Nodes (45): 01 · Imported mipik.vn (Live) / Components · Mipik Pickleball | Chuỗi Cửa Hàng Pickleball Chính Hãng · 1440, 01 · Imported mipik.vn (Live) / Mipik Pickleball | Chuỗi Cửa Hàng Pickleball Chính Hãng · 1440, 02 · 11Sport Storefront Screens / Group title · Content, Brand & Utility (1440 Desktop), 02 · 11Sport Storefront Screens / Group title · Core Shopping & Conversion (1440 Desktop), 02 · 11Sport Storefront Screens / Group title · Mobile Storefront (390 Responsive), 02 · 11Sport Storefront Screens / Mobile / Cart, 02 · 11Sport Storefront Screens / Mobile / Catalog, 02 · 11Sport Storefront Screens / Mobile / Checkout (+37 more)

### Community 20 - "lib/storefront.ts"
Cohesion: 0.07
Nodes (51): ProductDetailClientProps, buildStaticPageFromPolicyOrProgram(), MOCK_ARTICLE_CATEGORIES, MOCK_ARTICLES, MOCK_BRANDS, MOCK_CATEGORIES, MOCK_CUSTOMER_ORDERS, MOCK_CUSTOMER_PROFILE (+43 more)

### Community 21 - "StaffModule.tsx"
Cohesion: 0.13
Nodes (17): ContractFilePreviewModal(), preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer(), EditableImportRow, formatMoneyInput(), parseMoneyInput(), StaffModule() (+9 more)

### Community 22 - "cms/package.json"
Cohesion: 0.05
Nodes (36): dependencies, docx-preview, lucide-react, mammoth, next, react, react-dom, devDependencies (+28 more)

### Community 23 - "cms/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.09
Nodes (35): addDaysIso(), AvailableOffDayOption, CreateLeaveModal(), fmtDate(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, MyLeaveRequestsPanel() (+27 more)

### Community 24 - "2. Wireframe & Spec Storefront (`shop/`)"
Cohesion: 0.05
Nodes (36): 1.1 Luồng Mua hàng (Guest & Member) + Thanh toán QR 15 phút, 1.2 Luồng Tìm kiếm & Lọc danh mục, 1.3 Luồng Duyệt nội dung CEO / ADMIN trên CMS & Revalidate, 1. User Flow chính, 2.1 Trang chủ (`/`), 2.2 Danh mục cha (Brand Hub) & Danh mục con (`/danh-muc/[slug]`, `/thuong-hieu/[slug]`), 2.3 Chi tiết sản phẩm — PDP (`/san-pham/[slug]`), 2.4 Giỏ hàng (`/gio-hang`), Mini-Cart Drawer, Checkout (`/checkout`) & Order Success (+28 more)

### Community 25 - "ordersCustomers.ts"
Cohesion: 0.16
Nodes (16): IDebtPaymentRecord, ISplitPaymentItem, OrderShiftCode, getOrderEffectiveShiftAndDate(), getSalesAllowedBillDates(), inferShiftCodeFromTime(), isOrderInSalesCurrentShift(), isSalesOnlyUser() (+8 more)

### Community 26 - "web/package.json"
Cohesion: 0.05
Nodes (36): dependencies, docx-preview, lucide-react, mammoth, next, react, react-dom, devDependencies (+28 more)

### Community 27 - "web/src/lib/barcodeScanner.ts"
Cohesion: 0.22
Nodes (18): compactColorTokenForBarcode(), estimateCode128Dots(), isCompactBarcodeMatchVariant(), toCompactBarcode128(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), exactCodeMatch() (+10 more)

### Community 28 - "web/src/app/page.tsx"
Cohesion: 0.10
Nodes (49): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), isBlockedFromWebPos(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), AccountProfileTabProps (+41 more)

### Community 29 - "Header.tsx"
Cohesion: 0.11
Nodes (28): 4. Đồng Bộ Hợp Đồng API Backend & Sửa Lỗi Parity P0 + P1 (Chỉ sửa `shop/`, giữ nguyên `server/`), P0 · Khớp 100% Hợp Đồng BE Công Khai Hiện Có, P1 · Parity `mipik.vn` 1:1 & UX Storefront, Milestone 2: Enterprise Next.js Architecture (`d:\Pickball`), Task 6: Domain Entities, Bulk-Tier Pricing & Vietnamese Search Ranker (TDD), Task 7: Centralized Bilingual Mock Vault, Repository Pattern, Services & Mock-Isolation Gate (TDD), Task 9: Tokenized UI Primitives, Storefront Shell, Middleware & Full App Router SSR Architecture, 1. Intent & The Why (+20 more)

### Community 30 - "tin-tuc/[slug]/page.tsx"
Cohesion: 0.13
Nodes (26): getParam(), metadata, SearchPage(), SearchPageProps, BlogListPage(), BlogListPageProps, DEFAULT_CATEGORIES, generateMetadata() (+18 more)

### Community 31 - "seo.ts"
Cohesion: 0.09
Nodes (29): Task 8: Enterprise Google SEO Engine (`metadata`, `@graph` JSON-LD, Crawl-Budget Guard, Internal Links & SEO Analyzer — TDD), inter, jetbrainsMono, metadata, RootLayout(), ContactPage(), metadata, robots() (+21 more)

### Community 32 - "recodeProducts.ts"
Cohesion: 0.11
Nodes (30): RFC-4180, mongodb-memory-server, ApplyOptions, applyRecode(), ApplyReport, assertLocalMongoUri(), backupDatabase(), buildRecodePlan() (+22 more)

### Community 33 - "server/package.json"
Cohesion: 0.05
Nodes (41): cors, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies, cors (+33 more)

### Community 34 - "runner.ts"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 35 - "db.ts"
Cohesion: 0.05
Nodes (64): brandRepo, categoryRepo, customerOtpRepo, customerRepo, holidayRepo, orderRepo, productRepo, promotionRepo (+56 more)

### Community 36 - "web/src/components/HeaderAttendanceBar.tsx"
Cohesion: 0.13
Nodes (32): AttendanceModal(), Props, addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2(), Props (+24 more)

### Community 37 - "AttendanceTimesheetModule.tsx"
Cohesion: 0.13
Nodes (26): AttendanceTimesheetModule(), CELL_STYLE, CellDetailModal(), EditTarget, formatMinutes(), hasIssue(), HOURS_24, IssueFilter (+18 more)

### Community 38 - "cms/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.11
Nodes (33): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+25 more)

### Community 39 - "isMockApiEnabled"
Cohesion: 0.27
Nodes (10): sitemap(), isMockApiEnabled(), fetchArticles(), fetchHomeData(), fetchSitemapData(), getAllBrandsList(), getAllCategoriesList(), getAllPolicyPages() (+2 more)

### Community 40 - "ocr.ts"
Cohesion: 0.13
Nodes (23): ALLOWED_MIME, buildTagCodes(), buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS, DEFAULT_TAG_MODELS (+15 more)

### Community 41 - "PosServiceSection.tsx"
Cohesion: 0.15
Nodes (16): addDaysToDateStr(), computeServiceLinePricing(), diffDaysStr(), formatShortDate(), getTodayStr(), PaymentTimingMode, PosServiceSection(), ServiceCartLine (+8 more)

### Community 42 - "Order.ts"
Cohesion: 0.12
Nodes (16): DebtAdjustmentRecordSchema, DebtPaymentRecordSchema, DebtStatus, DiscountType, IDebtAdjustmentRecord, IOrder, IShippingAddress, OrderChannel (+8 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.08
Nodes (23): 1. Triết lý & Định hướng Thương hiệu (`shop/`), 2.1 Bảng màu chính & Kiểm định WCAG AA, 2.2 Neutral & Surfaces, 2.3 Semantic & Trạng thái, 2. Color Tokens (TailwindCSS & CSS Variables), 3. Typography & Định dạng hiển thị, 4.1 Breakpoints & Container, 4.2 Spacing & Radius (+15 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.10
Nodes (19): Holiday, 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions) (+11 more)

### Community 45 - "shifts.ts"
Cohesion: 0.09
Nodes (30): attendanceConfigRepo, attendanceRepo, leaveRequestRepo, shiftAssignmentRepo, shiftHandoverRepo, ADVANCE_NOTICE_DAYS_REQUIRED, getSalesMonthlyUnpaidOffDates(), SALES_MAX_OFF_PER_WEEK_SHIFT_REG (+22 more)

### Community 46 - "attendance.ts"
Cohesion: 0.23
Nodes (16): AttendanceConfig, attendanceRouter, _dnsCache, extractClientIp(), fetchCurrentPublicWanIp(), getEffectiveAttendanceConfig(), getEnvAttendanceConfig(), isIpAllowed() (+8 more)

### Community 47 - "attendanceTimesheet.ts"
Cohesion: 0.18
Nodes (17): applyManualOffForStaffDate(), attendanceTimesheetRouter, buildTimesheet(), combineDateAndMinutes(), computeAttendanceMetrics(), getLateToleranceMinutes(), getOfficeWorkdays(), getOvertimeMinMinutes() (+9 more)

### Community 48 - "promotions.ts"
Cohesion: 0.12
Nodes (21): IPromotion, IPromotionConditionCategory, IPromotionConditionProduct, IPromotionGiftItem, IPromotionTierPricing, PromotionChannel, PromotionConditionCategorySchema, PromotionConditionProductSchema (+13 more)

### Community 49 - "imports.ts"
Cohesion: 0.10
Nodes (36): ensureStandardProductCodesMigrated(), requireRoles(), applyMatchedScan(), enrichReceiptRoles(), importLockQueues, importsRouter, inferReceiptActorRole(), inferRole() (+28 more)

### Community 50 - "Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)"
Cohesion: 0.09
Nodes (21): 10.1 Rủi ro kỹ thuật & nghiệp vụ, 10.2 Điểm cần xác nhận thêm khi vào giai đoạn Design / Backend, 10. Rủi ro & Câu hỏi còn mở, 1.1 Bối cảnh hiện trạng, 1.2 Mục tiêu kinh doanh (MVP), 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi MVP (In-Scope), 2.2 Ngoài phạm vi MVP (Out-of-Scope — Giai đoạn 2+) (+13 more)

### Community 51 - "ReturnExchange.ts"
Cohesion: 0.20
Nodes (10): PaymentMethod, ExchangeItemSchema, IExchangeItem, IReturnExchange, IReturnItem, ReturnCondition, ReturnExchangeModel, ReturnExchangeSchema (+2 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.10
Nodes (19): 1. Kiến trúc & Cổng dịch vụ, 2.1 `server/` (Backend API), 2.2 `shop/` (Storefront khách hàng), 2.3 `cms/` (Trang quản trị), 2. Danh sách Biến môi trường bắt buộc, 3.1 Chạy với Docker Compose, 3.2 Chạy không dùng Docker (Local Node.js), 3. Hướng dẫn chạy Local (+11 more)

### Community 53 - "CameraScannerModal.tsx"
Cohesion: 0.16
Nodes (18): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl() (+10 more)

### Community 54 - "normalizeToCompactUpperCode"
Cohesion: 0.17
Nodes (23): findRowByKnownBarcode(), Issue, main(), checkLine(), compactColorTokenForBarcode(), isCompactBarcodeMatchVariant(), normalizeToCompactUpperCode(), normalizeToUpperCode() (+15 more)

### Community 55 - "leaveRequests.ts"
Cohesion: 0.23
Nodes (18): addDaysToDateStr(), assertAdvanceNoticeForLeaveRequest(), assertPaidLeaveQuota(), computePaidLeaveBalanceForStaff(), diffCalendarDays(), diffMonthsInclusive(), getConsecutivePaidLeaveCluster(), getMondayOfDateStr() (+10 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.22
Nodes (17): ColumnKey, inferContractType(), inferRoleAndDepartment(), matchSubHeaderKey(), matchTopHeaderKey(), normalizeCitizenIdCell(), normalizeGenderCell(), normalizePhoneCell() (+9 more)

### Community 57 - "ref_lucide_react"
Cohesion: 0.08
Nodes (56): BrandForm, BrandModule(), EMPTY_FORM, CategoryBrandModule(), SubTab, CategoryModule(), ColorInputWithPicker(), ColorSwatchBadge() (+48 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 59 - "Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 60 - "Repository"
Cohesion: 0.11
Nodes (14): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+6 more)

### Community 61 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, downlevelIteration, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 62 - "HrmAttendanceModule.tsx"
Cohesion: 0.36
Nodes (9): HrmAttendanceModule(), SubTab, createHolidayApi(), deleteHolidayApi(), fetchHolidays(), fetchLeaveRequests(), fetchShiftSchedule(), reviewLeaveRequestApi() (+1 more)

### Community 63 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 64 - "excel.ts"
Cohesion: 0.20
Nodes (16): CellValue, cellXml(), colLetter(), ColumnFormat, crc32(), CRC_TABLE, createXlsx(), escapeXml() (+8 more)

### Community 65 - "StockMovement"
Cohesion: 0.08
Nodes (28): StockMovement, 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)* (+20 more)

### Community 66 - "windowsPrinter.ts"
Cohesion: 0.08
Nodes (41): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+33 more)

### Community 67 - "Layout"
Cohesion: 0.50
Nodes (4): Component Layout Patterns, Grid Styles, Layout, Spacing & Size Tokens

### Community 68 - "TagCheckScannerModal.tsx"
Cohesion: 0.16
Nodes (18): downloadStaffImportTemplate(), Tiến độ dự án 11 Sport, Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase (+10 more)

### Community 69 - "pickleball Design System"
Cohesion: 0.14
Nodes (13): Agent Rules, Elevation & Depth, External & Library Components, Extraction Coverage, Iteration Guide, Known Gaps, Notes, Observed Layout & Visual Patterns (+5 more)

### Community 70 - "3.1 Public Storefront API (`/api/v1/public/*`)"
Cohesion: 0.17
Nodes (11): 1. Quy ước chung, 3.1 Public Storefront API (`/api/v1/public/*`), 3.2 Customer Authentication & Account (`/api/v1/public/customers/*`), 3.3 CMS Web Management (`/api/v1/cms/web/*`), 3. Hợp đồng API Website Bán Hàng (`shop/`) & CMS Quản Lý Website (`cms/`) *(v6.0)*, A. Trang chủ, Menu & Cấu hình Site, B. Danh mục, Thương hiệu & Sản phẩm, C. Blog, Trang tĩnh, Đánh giá & Liên hệ (+3 more)

### Community 71 - "11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 72 - "express"
Cohesion: 0.28
Nodes (14): express, convertSolar2Lunar(), externalHolidayCache, fetchNagerVietnamHolidays(), getLeapMonthOffset(), getLunarMonth11(), getMergedHolidayMap(), getNewMoonDay() (+6 more)

### Community 73 - "services"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 74 - "web"
Cohesion: 0.14
Nodes (14): depends_on, server, condition, web, depends_on, command, container_name, depends_on (+6 more)

### Community 75 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 76 - "Milestone 1: Figma Design System & Dedicated Storefront Components (`pickleball`)"
Cohesion: 0.22
Nodes (8): Global Constraints, Milestone 1: Figma Design System & Dedicated Storefront Components (`pickleball`), PikPro Pickleball — Design System, Storefront Components & Enterprise Next.js Architecture Plan, Review Focus, Task 1: Generate Reqwise Base Design System & Storefront Semantic Variables, Task 2: Build Storefront Global Chrome Components on Figma (Group A), Task 3: Build Storefront Catalog, Product Card & PDP Components on Figma (Group B), Task 4: Build News, Contact & Overlay Components on Figma (Group C) & Export `design-kit.md`

### Community 77 - "2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)"
Cohesion: 0.18
Nodes (10): 1. Tóm tắt Kết quả Thực thi (Execution Summary), 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`), Bộ Test Case & Kết quả Kiểm thử: Website Bán hàng 11 Sport (`shop/`), Backend (`server/`) & CMS (`cms/`), Nhóm 1: SEO & HTML Structure (`AC-01`, `BR-06`), Nhóm 2: 301 Redirect & Sitemap (`AC-02`, `BR-06`), Nhóm 3: Đồng bộ & Trừ kho Atomic POS vs Online (`AC-03`, `BR-01`, `BR-02`, `BR-03`), Nhóm 4: Checkout QR & Webhook Idempotency (`AC-04`, `BR-05`), Nhóm 5: Hết hạn giữ chỗ đơn QR 15 phút (`AC-05`) (+2 more)

### Community 78 - "volumes"
Cohesion: 0.15
Nodes (12): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+4 more)

### Community 79 - "environment"
Cohesion: 0.23
Nodes (13): environment, CORS_ORIGINS, JWT_SECRET, MONGODB_URI, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, NODE_ENV, PORT (+5 more)

### Community 80 - "web/src/app/layout.tsx"
Cohesion: 0.33
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

### Community 81 - "server"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.17
Nodes (12): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), G. `POST /api/v1/products/:id/variants` & `PATCH /api/v1/products/:id/variants` — thêm / sửa biến thể trên sản phẩm có sẵn, H. `PATCH /api/v1/products/:id` — trường mới (+4 more)

### Community 83 - "2. Đặc tả Chi tiết Các Màn hình & Wireframe"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.17
Nodes (11): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt), 3.4 Bán hàng (POS Order) & Xuất PDF, 3.5 Trả / Đổi hàng (Return & Exchange), 3. Quy tắc Nghiệp vụ đã chốt (Business Rules) (+3 more)

### Community 85 - "InventoryTab.tsx"
Cohesion: 0.10
Nodes (40): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+32 more)

### Community 86 - "2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)"
Cohesion: 0.17
Nodes (11): 1. Thống kê Lỗi theo Mức độ, 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved), 3. Kiểm thử Phi chức năng & Bảo mật cơ bản, 4. Danh sách Lỗi Đợt kiểm thử WEB-24 (Đã Xử lý & Xác minh Hồi quy), BUG-01: Nút chuyển nhanh vai trò (Quick Login) trên `web/` và `cms/` gửi mật khẩu mặc định chưa khớp với dữ liệu Seed của `server/`, BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`, BUG-03: Hiển thị mã phiếu Trả/Đổi trong thông báo thành công tại `ReturnExchangeTab.tsx`, BUG-04: Bảng hóa đơn khổ K80 bị tràn ngang do mã sản phẩm dài và dính nền trang khi bấm In PDF (+3 more)

### Community 87 - "ref_next"
Cohesion: 0.09
Nodes (18): dynamic, revalidate, embla-carousel-react, RevalidatePayload, CatalogClientProps, SORT_OPTIONS, ProductCarousel(), ProductCarouselProps (+10 more)

### Community 88 - "ShiftAssignment"
Cohesion: 0.32
Nodes (8): LeaveRequest, ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`)

### Community 89 - "index.ts"
Cohesion: 0.31
Nodes (9): dotenv, bootstrap(), PORT, releaseExpiredQrOrders(), assertSecurityEnvironment(), pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs() (+1 more)

### Community 90 - "healthcheck"
Cohesion: 0.56
Nodes (10): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+2 more)

### Community 91 - "ImportReceipt.ts"
Cohesion: 0.18
Nodes (10): 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*, IImportReceipt, IImportReceiptItem, ImportReceiptItemSchema, ImportReceiptModel, ImportReceiptSchema, ImportReceiptStatus, IScanCount (+2 more)

### Community 92 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 93 - "cms"
Cohesion: 0.22
Nodes (9): command, container_name, image, networks, ports, restart, volumes, working_dir (+1 more)

### Community 94 - "mongodb"
Cohesion: 0.22
Nodes (9): MONGO_INITDB_DATABASE, container_name, environment, image, networks, ports, restart, volumes (+1 more)

### Community 95 - "shop"
Cohesion: 0.22
Nodes (9): shop, command, container_name, image, networks, ports, restart, volumes (+1 more)

### Community 96 - "Kế hoạch: Website bán hàng tham chiếu mipik.vn (Next.js, SEO) + CMS Quản trị Web"
Cohesion: 0.22
Nodes (8): 1. Hiện trạng repo (đã đọc code), 2. Phân tích mipik.vn – những điểm cần bám theo, 3. Kiến trúc đề xuất, 4. CMS: tab mới "Quản lý Website" (quyền ADMIN, CEO), 5. Lộ trình (theo luồng pm → ba → designer → backend → frontend → tester), 6. Rủi ro, 7. Câu hỏi cần chốt, Kế hoạch: Website bán hàng tham chiếu mipik.vn (Next.js, SEO) + CMS Quản trị Web

### Community 97 - "shop/src/app/page.tsx"
Cohesion: 0.13
Nodes (22): 2. Toàn Bộ Components Hiện Có (`shop/src/components/`) — 21/21 `[x]` & Đã Xóa File Thừa, 3. Tầng Dữ Liệu & Mock API Contract (`shop/src/data/mock/` & `shop/src/repositories/mock/`), Bảng Theo Dõi & Đối Chiếu Tiến Độ Clone 1:1 `mipik.vn` → Figma `11Sport` → Next.js (`shop/`), Đã chuẩn hóa 100% sang Figma `11Sport` (`0` class token FE cũ còn sót lại), Đã xóa vĩnh viễn khỏi repo (`[x]`), framer-motion, HomePage(), localizeHomeSectionTitle() (+14 more)

### Community 98 - "format.ts"
Cohesion: 0.06
Nodes (64): Task 5: Initialize Git, Next.js 16 Enterprise Scaffold, Config & Figma Token Bridge, zustand, CheckoutPage(), metadata, CartPage(), metadata, metadata, OrderSuccessPage() (+56 more)

### Community 99 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.17
Nodes (11): 10. Phiếu bàn giao → backend-dev, 1. Hiện trạng đã xác minh trong code, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên (+3 more)

### Community 100 - "Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 101 - "Attendance.ts"
Cohesion: 0.25
Nodes (7): AttendanceCheckInType, AttendanceModel, AttendanceSchema, AttendanceStatus, IAttendance, OvertimeStatus, ShiftCode

### Community 102 - "middleware.ts"
Cohesion: 0.31
Nodes (8): API_BASE_URL, cachedRedirects, config, EN_ROUTE_ALIASES, getRedirects(), middleware(), normalizePath(), RedirectRule

### Community 103 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 104 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 105 - "next"
Cohesion: 0.29
Nodes (3): nextConfig, nextConfig, nextConfig

### Community 106 - "Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 107 - "Design System - 11Sport (POS, Kho & CMS)"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 108 - "Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 109 - "cms/src/app/layout.tsx"
Cohesion: 0.40
Nodes (4): inter, metadata, RootLayout(), VersionChecker()

### Community 110 - "Migration DB — 11 Sport"
Cohesion: 0.22
Nodes (5): Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 112 - "Skill GitHub gợi ý cho từng phòng ban"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 115 - "ref_path"
Cohesion: 0.19
Nodes (6): migration, migration, migration, toObjectId(), Migration, MigrationContext

### Community 123 - "REA Baseline — `https://mipik.vn/` Reverse-Engineering Summary"
Cohesion: 0.33
Nodes (5): Exact Navigation & Taxonomy Observed, Exact PDP Tiered Promo & Bulk Pricing Rules Observed, Measured Design Tokens, Measured Tech Stack & Live Defects, REA Baseline — `https://mipik.vn/` Reverse-Engineering Summary

### Community 124 - "ShiftHandover.ts"
Cohesion: 0.29
Nodes (6): HandoverStatus, IHandoverCategoryCount, IHandoverDiscrepancy, IShiftHandover, ShiftHandoverModel, ShiftHandoverSchema

### Community 125 - "Variable Colors"
Cohesion: 0.50
Nodes (4): color, Colors, store, Variable Colors

### Community 126 - "Styles"
Cohesion: 0.50
Nodes (4): Effect, Grid, Styles, Text

### Community 127 - "4. Quy tắc nghiệp vụ (Business Rules)"
Cohesion: 0.33
Nodes (6): 4.1 Cấu hình Ca & Tính Giờ Công, 4.2 Chấm công & Xác thực địa điểm, 4.3 Đăng ký lịch & Xếp ca Sales (Smart Scheduling), 4.4 Kiểm hàng Tầng 1 & Bàn giao ca Sales (Gối ca 12:00 - 17:30), 4.5 Lịch làm việc & Ngày lễ, 4. Quy tắc nghiệp vụ (Business Rules)

### Community 128 - "orderLock.ts"
Cohesion: 0.50
Nodes (3): deepCloneSnapshot(), orderLocks, withOrderLock()

### Community 129 - "middleware/auth.ts"
Cohesion: 0.07
Nodes (40): attachUserContext(), Express, invalidateStaffAuthCache(), Request, requireAuth(), resolveActiveStaffCached(), staffCache, ContractType (+32 more)

### Community 130 - "Do's and Don'ts"
Cohesion: 0.67
Nodes (3): Do, Do's and Don'ts, Don't

### Community 131 - "Shapes"
Cohesion: 0.67
Nodes (3): Observed Component Radii, Radius Tokens, Shapes

### Community 132 - "Variables"
Cohesion: 0.67
Nodes (3): Reqwise Tokens (Mode 1), Storefront (Mode 1), Variables

### Community 140 - "Centralized Mock Data Vault & Mock API Router (`shop/src/data/mock/`)"
Cohesion: 0.40
Nodes (4): 1. Quy tắc Kiến trúc (Kiểm tra tự động bởi `shop/tests/mock-isolation.test.ts`), 2. Danh sách 20 Public API Endpoints đã được Mock chuẩn Contract (`handlePublicApiRequest`), 3. Hướng dẫn cho đội Backend khi gắn API thật vào, Centralized Mock Data Vault & Mock API Router (`shop/src/data/mock/`)

## Knowledge Gaps
- **1237 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+1232 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1336 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StockMovement` connect `StockMovement` to `cms/src/lib/api.ts`, `TagCheckScannerModal.tsx`, `3.1 Public Storefront API (`/api/v1/public/*`)`, `exports.ts`, `2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)`, `2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*`, `Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)`, `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)`, `CameraScannerModal.tsx`, `ref_lucide_react`, `Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **What connects `nextConfig`, `name`, `version` to the rest of the system?**
  _1237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ref_react` be split into smaller, more focused modules?**
  _Cohesion score 0.09737098344693282 - nodes in this community are weakly interconnected._
- **Why does `executeUnpackSetToRetail()` connect `returns.ts` to `StockMovement`, `ApiError`, `ordersCustomers.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `cms/src/lib/api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04186952288218111 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `ApiError` to `middleware/auth.ts`, `windowsPrinter.ts`, `db.ts`, `customerAuth.ts`, `express`, `ocr.ts`, `returns.ts`, `attendance.ts`, `attendanceTimesheet.ts`, `promotions.ts`, `imports.ts`, `services.ts`, `shifts.ts`, `leaveRequests.ts`, `ordersCustomers.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `cms/src/app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06430745814307458 - nodes in this community are weakly interconnected._