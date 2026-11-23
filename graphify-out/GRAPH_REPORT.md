# Graph Report - 11sport-IT  (2026-11-23)

## Corpus Check
- 200 files · ~486,449 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 2109 nodes · 5300 edges · 107 communities (98 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bc95f0d2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/src/components/MyAttendanceCalendar.tsx
- cms/src/lib/api.ts
- apiRequest
- ordersCustomers.ts
- web/src/lib/api.ts
- seed.ts
- StaffModule.tsx
- ordersCustomers.ts
- InventoryModule.tsx
- db.ts
- seedWebStorefront.ts
- tagMatch.ts
- exports.ts
- productsInventory.ts
- shop/package.json
- ProductDetailClient.tsx
- web-models.test.ts
- utils/auth.ts
- ApiError
- imports.ts
- types/storefront.ts
- PosTab.tsx
- cms/package.json
- cms/src/components/MyAttendanceCalendar.tsx
- 2. Wireframe & Spec Storefront (`shop/`)
- middleware/auth.ts
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- reports.ts
- InventoryTab.tsx
- ProductCatalogModule.tsx
- shop/src/app/page.tsx
- ocr-speed.test.ts
- recodeProducts.ts
- server/package.json
- apiRequest
- publicStorefront.ts
- web/src/components/HeaderAttendanceBar.tsx
- AttendanceTimesheetModule.tsx
- services.ts
- danh-muc/[slug]/page.tsx
- ref_next
- web/src/components/HeaderAttendanceBar.tsx
- ocr.ts
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- shifts.ts
- attendance.ts
- attendanceTimesheet.ts
- promotions.ts
- normalizeToCompactUpperCode
- Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- CameraScannerModal.tsx
- app.ts
- leaveRequests.ts
- staffImportParser.ts
- cms/src/components/BarcodeLabelModal.tsx
- compilerOptions
- preparePreview
- Repository
- compilerOptions
- web/src/components/BarcodeLabelModal.tsx
- compilerOptions
- excel.ts
- 2. Danh sách Endpoints
- ReturnExchangeTab.tsx
- PosServiceSection.tsx
- web/src/components/BarcodeLabelModal.tsx
- cms/src/app/api/printers/route.ts
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- holidays.ts
- services
- web
- compilerOptions
- tagMatch.ts
- StaffUser
- volumes
- environment
- StockMovement
- StaffUser
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- web/src/components/HeaderAttendanceBar.tsx
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Baseline kiểm thử server — 2026-11-12
- excel.ts
- scripts
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- healthcheck
- web/src/components/LeaveRequests.tsx
- Order.ts
- ReturnExchange.ts
- HrmAttendanceModule.tsx
- utils/search.ts
- FridayShiftRegistrationModal.tsx
- ImportReceipt.ts
- 5. User Stories & Tiêu chí nghiệm thu (Acceptance Criteria)
- 4. Quy tắc nghiệp vụ (Business Rules)
- 2. Cấu hình Biến môi trường (Environment Variables)
- orderLock.ts

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

## Communities (107 total, 9 thin omitted)

### Community 0 - "web/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.13
Nodes (24): isPaidLeaveEligible(), addLocalDaysStr(), DayCell(), DayDetailModal(), fmtMinutes(), getNextMondayFallbackStr(), InfoBox(), LEAVE_STATUS (+16 more)

### Community 1 - "cms/src/lib/api.ts"
Cohesion: 0.05
Nodes (53): mongoose, holidayRepo, AttendanceCheckInType, AttendanceModel, AttendanceSchema, AttendanceStatus, IAttendance, OvertimeStatus (+45 more)

### Community 2 - "apiRequest"
Cohesion: 0.04
Nodes (77): DEFAULT_WEEKLY_SCHEDULE, getMonthStartStr(), localDateStr(), ShiftHandoverModule(), shiftLabel(), WEEKDAY_LABELS, buildCompactColorTokenFE(), confirmShiftHandoverApi() (+69 more)

### Community 3 - "ordersCustomers.ts"
Cohesion: 0.08
Nodes (38): CMS_MENU_ITEMS, CmsDashboardPage(), CmsModuleType, ROLE_ALLOWED_MODULES, AccountProfileModule(), AccountProfileModuleProps, getRoleDisplayName(), toIsoDateSlice() (+30 more)

### Community 4 - "web/src/lib/api.ts"
Cohesion: 0.13
Nodes (39): ROLE_LABEL, StaffActivityModule(), toInputDate(), ViewTab, formatVariantLabel(), StaffActivityReport, StaffActivitySummary, variantEffectiveCostPrice() (+31 more)

### Community 5 - "seed.ts"
Cohesion: 0.05
Nodes (53): ContractType, CurrentShiftOrdersSummary, DailyHandoverCategoryInfo, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, Department, EffectivePromotionStatus (+45 more)

### Community 6 - "StaffModule.tsx"
Cohesion: 0.13
Nodes (34): An toàn DB, supertest, vitest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), getDbMode() (+26 more)

### Community 7 - "ordersCustomers.ts"
Cohesion: 0.17
Nodes (15): DebtStatus, IDebtPaymentRecord, getOrderEffectiveShiftAndDate(), getSalesAllowedBillDates(), inferShiftCodeFromTime(), isOrderInSalesCurrentShift(), isSalesOnlyUser(), ORDER_MANAGER_ROLES (+7 more)

### Community 8 - "InventoryModule.tsx"
Cohesion: 0.11
Nodes (38): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+30 more)

### Community 9 - "db.ts"
Cohesion: 0.16
Nodes (28): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+20 more)

### Community 10 - "seedWebStorefront.ts"
Cohesion: 0.13
Nodes (39): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), isBlockedFromWebPos(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), toIsoDateSlice() (+31 more)

### Community 11 - "tagMatch.ts"
Cohesion: 0.08
Nodes (43): brandRepo, assertUniqueName(), brandUsage(), cleanAliases(), countProductsByBrand(), requireBrandManager(), validateCategoryIds(), Issue (+35 more)

### Community 12 - "exports.ts"
Cohesion: 0.14
Nodes (29): categoryRepo, ensureSystemBrand(), ensureCategorySkuCode(), requireCategoryManager(), validateSkuCode(), assignCategorySkuCodes(), BrandLike, ApiError (+21 more)

### Community 13 - "productsInventory.ts"
Cohesion: 0.08
Nodes (42): AttendanceTimesheetModule(), CELL_STYLE, CellDetailModal(), EditTarget, formatMinutes(), hasIssue(), HOURS_24, IssueFilter (+34 more)

### Community 14 - "shop/package.json"
Cohesion: 0.10
Nodes (38): DebtManagementModule(), DebtManagementModuleProps, InvoicePdfModal(), InvoicePdfModalProps, OrdersReturnsModuleProps, PromotionModule(), toDateTimeLocalInput(), AnimatedNumber() (+30 more)

### Community 15 - "ProductDetailClient.tsx"
Cohesion: 0.15
Nodes (37): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), stockMovementRepo, WarehouseFloor, keepCheckerFields(), applyPaidOrderSideEffects(), prepareOrderData(), assertPricePermission(), buildPatchedVariantsForProduct() (+29 more)

### Community 16 - "web-models.test.ts"
Cohesion: 0.06
Nodes (40): cors, mongodb-memory-server, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies, cors@^2.8.5 (+32 more)

### Community 17 - "utils/auth.ts"
Cohesion: 0.05
Nodes (57): attachUserContext(), Express, invalidateStaffAuthCache(), Request, requireAuth(), resolveActiveStaffCached(), staffCache, createRateLimiter() (+49 more)

### Community 18 - "ApiError"
Cohesion: 0.12
Nodes (27): tesseract.js, ALLOWED_MIME, buildTagCodes(), buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS (+19 more)

### Community 19 - "imports.ts"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 20 - "types/storefront.ts"
Cohesion: 0.09
Nodes (35): addDaysIso(), AvailableOffDayOption, CreateLeaveModal(), fmtDate(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, MyLeaveRequestsPanel() (+27 more)

### Community 21 - "PosTab.tsx"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 22 - "cms/package.json"
Cohesion: 0.10
Nodes (35): RFC-4180, ApplyOptions, applyRecode(), ApplyReport, assertLocalMongoUri(), backupDatabase(), buildRecodePlan(), bumpVersion() (+27 more)

### Community 23 - "cms/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.16
Nodes (21): CartItem, cartUnitPrice(), createDraft(), createEmptyDraftData(), DraftOrder, DraftOrderData, generateDraftId(), getCartLineKey() (+13 more)

### Community 24 - "2. Wireframe & Spec Storefront (`shop/`)"
Cohesion: 0.12
Nodes (31): ensureStandardProductCodesMigrated(), requireRoles(), applyMatchedScan(), enrichReceiptRoles(), findRowByKnownBarcode(), importLockQueues, inferReceiptActorRole(), inferRole() (+23 more)

### Community 25 - "middleware/auth.ts"
Cohesion: 0.10
Nodes (21): serviceTypeRepo, IServiceOrder, IServiceOrderItem, IServicePaymentRecord, ServiceDiscountType, ServiceOrderItemSchema, ServiceOrderModel, ServiceOrderSchema (+13 more)

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.15
Nodes (12): Holiday, 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions) (+4 more)

### Community 27 - "reports.ts"
Cohesion: 0.08
Nodes (22): customerRepo, importReceiptRepo, productRepo, returnExchangeRepo, serviceOrderRepo, DebtOrderRow, ProdStat, PushProdStat (+14 more)

### Community 28 - "InventoryTab.tsx"
Cohesion: 0.14
Nodes (22): ADVANCE_NOTICE_DAYS_REQUIRED, SALES_MAX_OFF_PER_WEEK_SHIFT_REG, SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG, SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG, addDaysStr(), buildDeterministicPermutation(), computeDailyHandoverCheck(), expireStalePendingHandovers() (+14 more)

### Community 29 - "ProductCatalogModule.tsx"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 30 - "shop/src/app/page.tsx"
Cohesion: 0.17
Nodes (20): express, attendanceConfigRepo, shiftHandoverRepo, AttendanceConfig, attendanceRouter, _dnsCache, extractClientIp(), fetchCurrentPublicWanIp() (+12 more)

### Community 31 - "ocr-speed.test.ts"
Cohesion: 0.33
Nodes (7): dotenv, PORT, pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs(), startKeepAlive(), app

### Community 32 - "recodeProducts.ts"
Cohesion: 0.13
Nodes (22): attendanceRepo, leaveRequestRepo, shiftAssignmentRepo, applyManualOffForStaffDate(), attendanceTimesheetRouter, buildTimesheet(), combineDateAndMinutes(), computeAttendanceMetrics() (+14 more)

### Community 33 - "server/package.json"
Cohesion: 0.13
Nodes (20): promotionRepo, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct, IPromotionGiftItem, PromotionConditionCategorySchema, PromotionConditionProductSchema, PromotionConditionType (+12 more)

### Community 34 - "apiRequest"
Cohesion: 0.14
Nodes (36): BrandForm, BrandModule(), EMPTY_FORM, CategoryBrandModule(), SubTab, CategoryModule(), ExportExcelButton(), buildFallbackPushProducts() (+28 more)

### Community 35 - "publicStorefront.ts"
Cohesion: 0.11
Nodes (20): 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*, 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)* (+12 more)

### Community 36 - "web/src/components/HeaderAttendanceBar.tsx"
Cohesion: 0.16
Nodes (18): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl() (+10 more)

### Community 37 - "AttendanceTimesheetModule.tsx"
Cohesion: 0.09
Nodes (16): dynamic, revalidate, inter, metadata, RootLayout(), VersionChecker(), dynamic, revalidate (+8 more)

### Community 38 - "services.ts"
Cohesion: 0.17
Nodes (15): printersRouter, CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter(), LabelPrintItem (+7 more)

### Community 39 - "danh-muc/[slug]/page.tsx"
Cohesion: 0.17
Nodes (6): migration, migration, migration, toObjectId(), Migration, MigrationContext

### Community 40 - "ref_next"
Cohesion: 0.23
Nodes (18): addDaysToDateStr(), assertAdvanceNoticeForLeaveRequest(), assertPaidLeaveQuota(), computePaidLeaveBalanceForStaff(), diffCalendarDays(), diffMonthsInclusive(), getConsecutivePaidLeaveCluster(), getMondayOfDateStr() (+10 more)

### Community 41 - "web/src/components/HeaderAttendanceBar.tsx"
Cohesion: 0.21
Nodes (20): AttendanceModal(), HeaderAttendanceBar(), localDateStr(), formatMoneyInput(), parseMoneyInput(), Props, ShiftHandoverModal(), AttendanceData (+12 more)

### Community 42 - "ocr.ts"
Cohesion: 0.22
Nodes (18): compactColorTokenForBarcode(), estimateCode128Dots(), isCompactBarcodeMatchVariant(), toCompactBarcode128(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), exactCodeMatch() (+10 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.14
Nodes (14): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging), 4. Kiểm tra Sức khỏe Hệ thống (Healthcheck & Giám sát), 5.1 Sao lưu (Backup), 5.2 Khôi phục (Restore), 5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore) (+6 more)

### Community 45 - "shifts.ts"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 46 - "attendance.ts"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "attendanceTimesheet.ts"
Cohesion: 0.17
Nodes (17): addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf(), mondayOf(), pad(), ROWS (+9 more)

### Community 48 - "promotions.ts"
Cohesion: 0.15
Nodes (16): addDaysToDateStr(), computeServiceLinePricing(), diffDaysStr(), formatShortDate(), getTodayStr(), PaymentTimingMode, PosServiceSection(), ServiceCartLine (+8 more)

### Community 49 - "normalizeToCompactUpperCode"
Cohesion: 0.19
Nodes (16): Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase, ResultKind, scannedOf() (+8 more)

### Community 50 - "Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 51 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.14
Nodes (14): StockMovement, 2.3 Kho hàng, Sản phẩm & Sổ kho (`/products`, `/inventory`), 2.4 Nhập kho (`/imports`), 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`), 2.6 Trả / Đổi hàng (`/returns`), G. `POST /api/v1/products/:id/variants` & `PATCH /api/v1/products/:id/variants` — thêm / sửa biến thể trên sản phẩm có sẵn, 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement) (+6 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "CameraScannerModal.tsx"
Cohesion: 0.30
Nodes (13): convertSolar2Lunar(), externalHolidayCache, fetchNagerVietnamHolidays(), getLeapMonthOffset(), getLunarMonth11(), getMergedHolidayMap(), getNewMoonDay(), getSunLongitude() (+5 more)

### Community 54 - "app.ts"
Cohesion: 0.27
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 55 - "leaveRequests.ts"
Cohesion: 0.18
Nodes (17): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+9 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "cms/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.27
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 58 - "compilerOptions"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "preparePreview"
Cohesion: 0.40
Nodes (4): preparePreview(), dataUrlToArrayBuffer(), preparePreview(), dataUrlToArrayBuffer()

### Community 60 - "Repository"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "compilerOptions"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "compilerOptions"
Cohesion: 0.17
Nodes (11): 10. Phiếu bàn giao → backend-dev, 1. Hiện trạng đã xác minh trong code, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên (+3 more)

### Community 64 - "excel.ts"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2. Danh sách Endpoints"
Cohesion: 0.18
Nodes (11): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), H. `PATCH /api/v1/products/:id` — trường mới, I. `GET /api/v1/products/lookup?code=<mã quét>` (+3 more)

### Community 66 - "ReturnExchangeTab.tsx"
Cohesion: 0.38
Nodes (9): formatPaymentMethodLabel(), formatShiftBadge(), formatShortVnDate(), getLocalDateStr(), getRecentQuickDates(), PosShiftBillsSection(), PosShiftBillsSectionProps, CurrentShiftOrdersMeta (+1 more)

### Community 67 - "PosServiceSection.tsx"
Cohesion: 0.22
Nodes (4): downloadStaffImportTemplate(), 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), Tiến độ dự án 11 Sport

### Community 68 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.20
Nodes (15): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+7 more)

### Community 69 - "cms/src/app/api/printers/route.ts"
Cohesion: 0.22
Nodes (9): command, container_name, image, networks, ports, restart, volumes, working_dir (+1 more)

### Community 70 - "3.1 Public Storefront API (`/api/v1/public/*`)"
Cohesion: 0.31
Nodes (9): environment, CORS_ORIGINS, JWT_SECRET, MONGODB_URI, NEXT_PUBLIC_API_URL, NODE_ENV, PORT, environment (+1 more)

### Community 71 - "11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)"
Cohesion: 0.56
Nodes (9): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+1 more)

### Community 72 - "holidays.ts"
Cohesion: 0.22
Nodes (9): MONGO_INITDB_DATABASE, container_name, environment, image, networks, ports, restart, volumes (+1 more)

### Community 73 - "services"
Cohesion: 0.22
Nodes (8): 1. Thống kê Lỗi theo Mức độ, 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved), 3. Kiểm thử Phi chức năng & Bảo mật cơ bản, BUG-01: Nút chuyển nhanh vai trò (Quick Login) trên `web/` và `cms/` gửi mật khẩu mặc định chưa khớp với dữ liệu Seed của `server/`, BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`, BUG-03: Hiển thị mã phiếu Trả/Đổi trong thông báo thành công tại `ReturnExchangeTab.tsx`, BUG-04: Bảng hóa đơn khổ K80 bị tràn ngang do mã sản phẩm dài và dính nền trang khi bấm In PDF, Báo cáo Lỗi (Bug Report) - 11Sport (v1.0)

### Community 74 - "web"
Cohesion: 0.32
Nodes (8): LeaveRequest, ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`)

### Community 75 - "compilerOptions"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 76 - "tagMatch.ts"
Cohesion: 0.26
Nodes (14): compactColorTokenForBarcode(), isCompactBarcodeMatchVariant(), toCompactBarcode128(), collapseUnikeyBackspaceStutter(), getBarcodeCandidatesServer(), isScannedCodeMatchServer(), isSkuToken(), matchTagToItems() (+6 more)

### Community 77 - "StaffUser"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 78 - "volumes"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 79 - "environment"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 80 - "StockMovement"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 81 - "StaffUser"
Cohesion: 0.20
Nodes (13): AccountProfileTabProps, Props, DrawerMenu(), DrawerMenuProps, DrawerPageType, TabConfig, TabType, Props (+5 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "web/src/components/HeaderAttendanceBar.tsx"
Cohesion: 0.33
Nodes (5): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 4. Tiêu chí Nghiệm thu (Acceptance Criteria), Phạm vi hệ thống (3 thành phần), Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "excel.ts"
Cohesion: 0.40
Nodes (5): Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 87 - "scripts"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 96 - "web/src/components/LeaveRequests.tsx"
Cohesion: 0.20
Nodes (14): CONTRACT_LABEL, fmtDate(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, LeaveRequestModal(), MyLeaveRequestsPanel(), pad() (+6 more)

### Community 97 - "Order.ts"
Cohesion: 0.14
Nodes (13): DebtAdjustmentRecordSchema, DebtPaymentRecordSchema, DiscountType, IDebtAdjustmentRecord, IOrder, ISplitPaymentItem, OrderItemSchema, OrderModel (+5 more)

### Community 98 - "ReturnExchange.ts"
Cohesion: 0.20
Nodes (10): PaymentMethod, ExchangeItemSchema, IExchangeItem, IReturnExchange, IReturnItem, ReturnCondition, ReturnExchangeModel, ReturnExchangeSchema (+2 more)

### Community 99 - "HrmAttendanceModule.tsx"
Cohesion: 0.36
Nodes (9): HrmAttendanceModule(), SubTab, createHolidayApi(), deleteHolidayApi(), fetchHolidays(), fetchLeaveRequests(), fetchShiftSchedule(), reviewLeaveRequestApi() (+1 more)

### Community 100 - "utils/search.ts"
Cohesion: 0.40
Nodes (8): boundedEditDistance(), compactAlphaNum(), getWordInitials(), normalizePhoneDigits(), normalizeVietnamese(), scoreSearchMatch(), SearchFieldWeight, app

### Community 101 - "FridayShiftRegistrationModal.tsx"
Cohesion: 0.36
Nodes (9): addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2(), Props, toLocalDateStr(), fetchMyShiftScheduleApi() (+1 more)

### Community 102 - "ImportReceipt.ts"
Cohesion: 0.25
Nodes (7): IImportReceipt, ImportReceiptItemSchema, ImportReceiptModel, ImportReceiptSchema, ImportReceiptStatus, IScanCount, WarehouseFloor

### Community 103 - "5. User Stories & Tiêu chí nghiệm thu (Acceptance Criteria)"
Cohesion: 0.29
Nodes (7): 5. User Stories & Tiêu chí nghiệm thu (Acceptance Criteria), US-01: Chấm công kết hợp GPS & Mạng LAN, US-02: Đăng ký lịch bận và Tự động xếp ca Sales, US-03: HR Kéo - Thả xếp ca khi có trùng lịch, US-04: Bàn giao Kho Tầng 1 & Mở khóa Check-out, US-05: Làm tròn Check-in sớm & Tạm dừng Giờ nghỉ trưa, US-06: Xin chuyển ngày off (Đổi ngày nghỉ) cần HR duyệt

### Community 104 - "4. Quy tắc nghiệp vụ (Business Rules)"
Cohesion: 0.33
Nodes (6): 4.1 Cấu hình Ca & Tính Giờ Công, 4.2 Chấm công & Xác thực địa điểm, 4.3 Đăng ký lịch & Xếp ca Sales (Smart Scheduling), 4.4 Kiểm hàng Tầng 1 & Bàn giao ca Sales (Gối ca 12:00 - 17:30), 4.5 Lịch làm việc & Ngày lễ, 4. Quy tắc nghiệp vụ (Business Rules)

### Community 105 - "2. Cấu hình Biến môi trường (Environment Variables)"
Cohesion: 0.50
Nodes (4): 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables)

### Community 106 - "orderLock.ts"
Cohesion: 0.50
Nodes (3): deepCloneSnapshot(), orderLocks, withOrderLock()

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 702 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StockMovement` connect `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)` to `apiRequest`, `PosServiceSection.tsx`, `web/src/lib/api.ts`, `web/src/components/HeaderAttendanceBar.tsx`, `InventoryModule.tsx`, `Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)`, `web/src/components/HeaderAttendanceBar.tsx`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/src/components/MyAttendanceCalendar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Why does `2.6 Trả / Đổi hàng (`/returns`)` connect `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)` to `publicStorefront.ts`, `ProductDetailClient.tsx`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Should `cms/src/lib/api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.047086247086247084 - nodes in this community are weakly interconnected._
- **Why does `executeUnpackSetToRetail()` connect `ProductDetailClient.tsx` to `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)`, `exports.ts`, `ordersCustomers.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `apiRequest` be split into smaller, more focused modules?**
  _Cohesion score 0.03908316191595651 - nodes in this community are weakly interconnected._