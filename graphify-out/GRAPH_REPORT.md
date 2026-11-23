# Graph Report - 11sport-IT  (2026-11-22)

## Corpus Check
- 200 files · ~485,735 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 2107 nodes · 5297 edges · 96 communities (87 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a018d3a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/src/components/MyAttendanceCalendar.tsx
- db.ts
- cms/src/lib/api.ts
- ref_react
- exports.ts
- web/src/lib/api.ts
- app.ts
- ordersCustomers.ts
- InventoryModule.tsx
- InventoryTab.tsx
- web/src/app/page.tsx
- productCode.ts
- productScheme.ts
- AttendanceTimesheetModule.tsx
- RevenueDashboardModule.tsx
- productsInventory.ts
- server/package.json
- middleware/auth.ts
- ApiError
- cms/package.json
- cms/src/components/MyAttendanceCalendar.tsx
- web/package.json
- recodeProducts.ts
- PosTab.tsx
- imports.ts
- services.ts
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- reports.ts
- shifts.ts
- runner.ts
- attendance.ts
- importPdfInventory.ts
- attendanceTimesheet.ts
- promotions.ts
- cms/src/lib/barcodeScanner.ts
- 2. Danh sách Endpoints
- CameraScannerModal.tsx
- cms/src/app/layout.tsx
- windowsPrinter.ts
- recode-products.test.ts
- leaveRequests.ts
- staffImportParser.ts
- web/src/lib/barcodeScanner.ts
- compilerOptions
- Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0
- Repository
- compilerOptions
- ShiftScheduleModule.tsx
- PosServiceSection.tsx
- TagCheckScannerModal.tsx
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- StockMovement
- services
- holidays.ts
- cms/src/app/api/printers/route.ts
- cms/src/components/BarcodeLabelModal.tsx
- compilerOptions
- web/src/app/api/printers/route.ts
- web
- cms/src/components/ContractFilePreviewModal.tsx
- volumes
- server
- 2. Đặc tả Chi tiết Các Màn hình & Wireframe
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- Baseline kiểm thử server — 2026-11-12
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- PosShiftBillsSection.tsx
- Tiến độ dự án 11 Sport
- cms/src/lib/search.ts
- cms
- environment
- healthcheck
- mongodb
- 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)
- ShiftAssignment
- Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS
- wise.ts
- WiseCalculatorStash.tsx
- Dự án bán hàng 11 Sport
- Dự án bán hàng 11 Sport
- Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)
- web/src/app/layout.tsx
- Design System - 11Sport (POS, Kho & CMS)
- Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)
- Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)
- cms/next.config.mjs
- Migration DB — 11 Sport
- Skill GitHub gợi ý cho từng phòng ban
- pre-commit-graphify.sh
- start-dev.sh

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 67 edges
2. `normalizeToCompactUpperCode()` - 52 edges
3. `apiRequest()` - 41 edges
4. `InventoryModule()` - 37 edges
5. `PosTab()` - 36 edges
6. `createApp()` - 31 edges
7. `apiRequest()` - 30 edges
8. `seedDatabaseIfNeeded()` - 28 edges
9. `generateVariantProductCode()` - 27 edges
10. `connectDatabase()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/lib/api.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `B. Quản lý Đơn Dịch Vụ (`/service-orders`)` --references--> `status()`  [INFERRED]
  docs/api-contract.md → server/src/migrations/runner.ts
- `3.1 Danh mục (Category) & Sản phẩm (Product)` --references--> `status()`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → server/src/migrations/runner.ts
- `Cơ chế an toàn` --references--> `down()`  [INFERRED]
  docs/devops/migrations.md → server/src/migrations/runner.ts

## Import Cycles
- 2-file cycle: `server/src/routes/brands.ts -> server/src/utils/productScheme.ts -> server/src/routes/brands.ts`
- 2-file cycle: `server/src/routes/categories.ts -> server/src/utils/productScheme.ts -> server/src/routes/categories.ts`

## Communities (96 total, 9 thin omitted)

### Community 0 - "web/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.05
Nodes (72): AccountProfileTabProps, AttendanceModal(), Props, addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2() (+64 more)

### Community 1 - "db.ts"
Cohesion: 0.04
Nodes (61): mongoose, attendanceRepo, holidayRepo, AttendanceCheckInType, AttendanceModel, AttendanceSchema, AttendanceStatus, IAttendance (+53 more)

### Community 2 - "cms/src/lib/api.ts"
Cohesion: 0.04
Nodes (67): DEFAULT_WEEKLY_SCHEDULE, getMonthStartStr(), localDateStr(), ShiftHandoverModule(), shiftLabel(), WEEKDAY_LABELS, buildCompactColorTokenFE(), confirmShiftHandoverApi() (+59 more)

### Community 3 - "ref_react"
Cohesion: 0.08
Nodes (47): CMS_MENU_ITEMS, CmsDashboardPage(), CmsModuleType, ROLE_ALLOWED_MODULES, AccountProfileModule(), AccountProfileModuleProps, getRoleDisplayName(), toIsoDateSlice() (+39 more)

### Community 4 - "exports.ts"
Cohesion: 0.10
Nodes (50): BrandForm, BrandModule(), EMPTY_FORM, SubTab, CategoryModule(), ExportExcelButton(), ExportExcelButtonProps, buildFallbackPushProducts() (+42 more)

### Community 5 - "web/src/lib/api.ts"
Cohesion: 0.05
Nodes (50): buildCompactColorTokenFE(), ContractType, CurrentShiftOrdersSummary, DailyHandoverCategoryInfo, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, Department (+42 more)

### Community 6 - "app.ts"
Cohesion: 0.14
Nodes (32): An toàn DB, supertest, vitest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), getDbMode() (+24 more)

### Community 7 - "ordersCustomers.ts"
Cohesion: 0.06
Nodes (43): requireRoles(), DebtAdjustmentRecordSchema, DebtPaymentRecordSchema, DebtStatus, DiscountType, IDebtAdjustmentRecord, IDebtPaymentRecord, IOrder (+35 more)

### Community 8 - "InventoryModule.tsx"
Cohesion: 0.10
Nodes (45): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+37 more)

### Community 9 - "InventoryTab.tsx"
Cohesion: 0.10
Nodes (43): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+35 more)

### Community 10 - "web/src/app/page.tsx"
Cohesion: 0.12
Nodes (39): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), isBlockedFromWebPos(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), toIsoDateSlice() (+31 more)

### Community 11 - "productCode.ts"
Cohesion: 0.08
Nodes (41): brandRepo, assertUniqueName(), brandsRouter, brandUsage(), cleanAliases(), countProductsByBrand(), findRowByKnownBarcode(), Issue (+33 more)

### Community 12 - "productScheme.ts"
Cohesion: 0.10
Nodes (42): ensureSystemBrand(), ensureCategorySkuCode(), assignCategorySkuCodes(), BrandLike, brandTerms(), buildBrandSeedList(), EXTRA_ALIASES, findBrandExact() (+34 more)

### Community 13 - "AttendanceTimesheetModule.tsx"
Cohesion: 0.08
Nodes (42): AttendanceTimesheetModule(), CELL_STYLE, CellDetailModal(), EditTarget, formatMinutes(), hasIssue(), HOURS_24, IssueFilter (+34 more)

### Community 14 - "RevenueDashboardModule.tsx"
Cohesion: 0.10
Nodes (39): DebtManagementModule(), DebtManagementModuleProps, InvoicePdfModal(), InvoicePdfModalProps, OrdersReturnsModuleProps, PromotionModule(), toDateTimeLocalInput(), AnimatedNumber() (+31 more)

### Community 15 - "productsInventory.ts"
Cohesion: 0.14
Nodes (38): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), stockMovementRepo, WarehouseFloor, keepCheckerFields(), applyPaidOrderSideEffects(), prepareOrderData(), assertPricePermission(), buildPatchedVariantsForProduct() (+30 more)

### Community 16 - "server/package.json"
Cohesion: 0.06
Nodes (41): cors, mongodb-memory-server, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies (+33 more)

### Community 17 - "middleware/auth.ts"
Cohesion: 0.08
Nodes (34): attachUserContext(), Express, invalidateStaffAuthCache(), Request, resolveActiveStaffCached(), staffCache, createRateLimiter(), getRequestIpKey() (+26 more)

### Community 18 - "ApiError"
Cohesion: 0.09
Nodes (36): express, categoryRepo, requireBrandManager(), validateCategoryIds(), requireCategoryManager(), validateSkuCode(), parseCostPrice(), parseSellingPrice() (+28 more)

### Community 19 - "cms/package.json"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 20 - "cms/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.09
Nodes (35): addDaysIso(), AvailableOffDayOption, CreateLeaveModal(), fmtDate(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, MyLeaveRequestsPanel() (+27 more)

### Community 21 - "web/package.json"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 22 - "recodeProducts.ts"
Cohesion: 0.10
Nodes (34): RFC-4180, ApplyOptions, applyRecode(), ApplyReport, assertLocalMongoUri(), backupDatabase(), buildRecodePlan(), bumpVersion() (+26 more)

### Community 23 - "PosTab.tsx"
Cohesion: 0.12
Nodes (31): CartItem, cartUnitPrice(), createDraft(), createEmptyDraftData(), DraftOrder, DraftOrderData, generateDraftId(), getCartLineKey() (+23 more)

### Community 24 - "imports.ts"
Cohesion: 0.15
Nodes (25): ensureStandardProductCodesMigrated(), applyMatchedScan(), enrichReceiptRoles(), importLockQueues, inferReceiptActorRole(), inferRole(), isFullItem(), normalizeImportItems() (+17 more)

### Community 25 - "services.ts"
Cohesion: 0.10
Nodes (21): customerRepo, serviceTypeRepo, IServiceOrder, IServiceOrderItem, IServicePaymentRecord, ServiceDiscountType, ServiceOrderItemSchema, ServiceOrderModel (+13 more)

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.08
Nodes (25): Holiday, 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions) (+17 more)

### Community 27 - "reports.ts"
Cohesion: 0.11
Nodes (19): serviceOrderRepo, DebtOrderRow, ProdStat, PushProdStat, reportsRouter, SalesActivity, SalesType, ServiceTypeStat (+11 more)

### Community 28 - "shifts.ts"
Cohesion: 0.14
Nodes (22): ADVANCE_NOTICE_DAYS_REQUIRED, SALES_MAX_OFF_PER_WEEK_SHIFT_REG, SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG, SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG, addDaysStr(), buildDeterministicPermutation(), computeDailyHandoverCheck(), expireStalePendingHandovers() (+14 more)

### Community 29 - "runner.ts"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 30 - "attendance.ts"
Cohesion: 0.19
Nodes (19): attendanceConfigRepo, shiftHandoverRepo, AttendanceConfig, attendanceRouter, _dnsCache, extractClientIp(), fetchCurrentPublicWanIp(), getEffectiveAttendanceConfig() (+11 more)

### Community 31 - "importPdfInventory.ts"
Cohesion: 0.14
Nodes (17): dotenv, importReceiptRepo, productRepo, bootstrap(), PORT, apiCall(), buildProductName(), FLOOR_1_ITEMS (+9 more)

### Community 32 - "attendanceTimesheet.ts"
Cohesion: 0.15
Nodes (20): leaveRequestRepo, applyManualOffForStaffDate(), attendanceTimesheetRouter, buildTimesheet(), combineDateAndMinutes(), computeAttendanceMetrics(), getLateToleranceMinutes(), getOfficeWorkdays() (+12 more)

### Community 33 - "promotions.ts"
Cohesion: 0.13
Nodes (20): promotionRepo, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct, IPromotionGiftItem, PromotionConditionCategorySchema, PromotionConditionProductSchema, PromotionConditionType (+12 more)

### Community 34 - "cms/src/lib/barcodeScanner.ts"
Cohesion: 0.19
Nodes (20): compactColorTokenForBarcode(), estimateCode128Dots(), isCompactBarcodeMatchVariant(), toCompactBarcode128(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), exactCodeMatch() (+12 more)

### Community 35 - "2. Danh sách Endpoints"
Cohesion: 0.11
Nodes (20): 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*, 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)* (+12 more)

### Community 36 - "CameraScannerModal.tsx"
Cohesion: 0.16
Nodes (18): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl() (+10 more)

### Community 37 - "cms/src/app/layout.tsx"
Cohesion: 0.12
Nodes (11): dynamic, revalidate, inter, metadata, RootLayout(), VersionChecker(), dynamic, revalidate (+3 more)

### Community 38 - "windowsPrinter.ts"
Cohesion: 0.17
Nodes (15): printersRouter, CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter(), LabelPrintItem (+7 more)

### Community 39 - "recode-products.test.ts"
Cohesion: 0.14
Nodes (7): migration, migration, migration, toObjectId(), Migration, MigrationContext, ReviewRow

### Community 40 - "leaveRequests.ts"
Cohesion: 0.23
Nodes (18): addDaysToDateStr(), assertAdvanceNoticeForLeaveRequest(), assertPaidLeaveQuota(), computePaidLeaveBalanceForStaff(), diffCalendarDays(), diffMonthsInclusive(), getConsecutivePaidLeaveCluster(), getMondayOfDateStr() (+10 more)

### Community 41 - "staffImportParser.ts"
Cohesion: 0.21
Nodes (18): parseCsvTextToMatrix(), ColumnKey, inferContractType(), inferRoleAndDepartment(), matchSubHeaderKey(), matchTopHeaderKey(), normalizeCitizenIdCell(), normalizeGenderCell() (+10 more)

### Community 42 - "web/src/lib/barcodeScanner.ts"
Cohesion: 0.22
Nodes (18): compactColorTokenForBarcode(), estimateCode128Dots(), isCompactBarcodeMatchVariant(), toCompactBarcode128(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), exactCodeMatch() (+10 more)

### Community 43 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 45 - "Repository"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 46 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "ShiftScheduleModule.tsx"
Cohesion: 0.18
Nodes (16): addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf(), mondayOf(), pad(), ROWS (+8 more)

### Community 48 - "PosServiceSection.tsx"
Cohesion: 0.15
Nodes (16): addDaysToDateStr(), computeServiceLinePricing(), diffDaysStr(), formatShortDate(), getTodayStr(), PaymentTimingMode, PosServiceSection(), ServiceCartLine (+8 more)

### Community 49 - "TagCheckScannerModal.tsx"
Cohesion: 0.19
Nodes (16): Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase, ResultKind, scannedOf() (+8 more)

### Community 50 - "11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 51 - "StockMovement"
Cohesion: 0.14
Nodes (14): StockMovement, 2.3 Kho hàng, Sản phẩm & Sổ kho (`/products`, `/inventory`), 2.4 Nhập kho (`/imports`), 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`), 2.6 Trả / Đổi hàng (`/returns`), G. `POST /api/v1/products/:id/variants` & `PATCH /api/v1/products/:id/variants` — thêm / sửa biến thể trên sản phẩm có sẵn, 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement) (+6 more)

### Community 52 - "services"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "holidays.ts"
Cohesion: 0.30
Nodes (13): convertSolar2Lunar(), externalHolidayCache, fetchNagerVietnamHolidays(), getLeapMonthOffset(), getLunarMonth11(), getMergedHolidayMap(), getNewMoonDay(), getSunLongitude() (+5 more)

### Community 54 - "cms/src/app/api/printers/route.ts"
Cohesion: 0.27
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 55 - "cms/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.23
Nodes (13): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+5 more)

### Community 56 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "web/src/app/api/printers/route.ts"
Cohesion: 0.27
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 58 - "web"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "cms/src/components/ContractFilePreviewModal.tsx"
Cohesion: 0.21
Nodes (6): preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer(), preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer()

### Community 60 - "volumes"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "server"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "2. Đặc tả Chi tiết Các Màn hình & Wireframe"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.17
Nodes (11): 10. Phiếu bàn giao → backend-dev, 1. Hiện trạng đã xác minh trong code, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên (+3 more)

### Community 64 - "Baseline kiểm thử server — 2026-11-12"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.18
Nodes (11): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), H. `PATCH /api/v1/products/:id` — trường mới, I. `GET /api/v1/products/lookup?code=<mã quét>` (+3 more)

### Community 66 - "PosShiftBillsSection.tsx"
Cohesion: 0.35
Nodes (10): formatPaymentMethodLabel(), formatShiftBadge(), formatShortVnDate(), getLocalDateStr(), getRecentQuickDates(), PosShiftBillsSection(), PosShiftBillsSectionProps, CurrentShiftOrdersMeta (+2 more)

### Community 67 - "Tiến độ dự án 11 Sport"
Cohesion: 0.22
Nodes (4): downloadStaffImportTemplate(), 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), Tiến độ dự án 11 Sport

### Community 68 - "cms/src/lib/search.ts"
Cohesion: 0.39
Nodes (8): boundedEditDistanceLeq1(), buildAcronym(), compactAlphaNum(), normalizePhoneDigits(), normalizeVietnamese(), PreparedField, scoreSearchMatch(), SearchField

### Community 69 - "cms"
Cohesion: 0.22
Nodes (9): command, container_name, image, networks, ports, restart, volumes, working_dir (+1 more)

### Community 70 - "environment"
Cohesion: 0.31
Nodes (9): environment, CORS_ORIGINS, JWT_SECRET, MONGODB_URI, NEXT_PUBLIC_API_URL, NODE_ENV, PORT, environment (+1 more)

### Community 71 - "healthcheck"
Cohesion: 0.56
Nodes (9): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+1 more)

### Community 72 - "mongodb"
Cohesion: 0.22
Nodes (9): MONGO_INITDB_DATABASE, container_name, environment, image, networks, ports, restart, volumes (+1 more)

### Community 73 - "2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)"
Cohesion: 0.22
Nodes (8): 1. Thống kê Lỗi theo Mức độ, 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved), 3. Kiểm thử Phi chức năng & Bảo mật cơ bản, BUG-01: Nút chuyển nhanh vai trò (Quick Login) trên `web/` và `cms/` gửi mật khẩu mặc định chưa khớp với dữ liệu Seed của `server/`, BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`, BUG-03: Hiển thị mã phiếu Trả/Đổi trong thông báo thành công tại `ReturnExchangeTab.tsx`, BUG-04: Bảng hóa đơn khổ K80 bị tràn ngang do mã sản phẩm dài và dính nền trang khi bấm In PDF, Báo cáo Lỗi (Bug Report) - 11Sport (v1.0)

### Community 74 - "ShiftAssignment"
Cohesion: 0.32
Nodes (8): LeaveRequest, ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`)

### Community 75 - "Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 76 - "wise.ts"
Cohesion: 0.29
Nodes (6): requireAuth(), fetchWiseQuoteRaw(), getWiseConfig(), SUPPORTED_CURRENCIES, WiseCurrencyInfo, wiseRouter

### Community 77 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 78 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 79 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 80 - "Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 81 - "web/src/app/layout.tsx"
Cohesion: 0.33
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

### Community 82 - "Design System - 11Sport (POS, Kho & CMS)"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)"
Cohesion: 0.33
Nodes (5): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 4. Tiêu chí Nghiệm thu (Acceptance Criteria), Phạm vi hệ thống (3 thành phần), Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)

### Community 84 - "Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "Migration DB — 11 Sport"
Cohesion: 0.40
Nodes (5): Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 87 - "Skill GitHub gợi ý cho từng phòng ban"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 701 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StockMovement` connect `StockMovement` to `cms/src/lib/api.ts`, `Tiến độ dự án 11 Sport`, `exports.ts`, `CameraScannerModal.tsx`, `InventoryModule.tsx`, `Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0`, `Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)`?**
  _High betweenness centrality (0.247) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/src/components/MyAttendanceCalendar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.054612054612054615 - nodes in this community are weakly interconnected._
- **Why does `2.6 Trả / Đổi hàng (`/returns`)` connect `StockMovement` to `2. Danh sách Endpoints`, `productsInventory.ts`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04072072072072072 - nodes in this community are weakly interconnected._
- **Why does `executeUnpackSetToRetail()` connect `productsInventory.ts` to `ApiError`, `StockMovement`, `ordersCustomers.ts`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Should `cms/src/lib/api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04342723004694836 - nodes in this community are weakly interconnected._