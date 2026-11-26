# Graph Report - 11sport-IT  (2026-11-26)

## Corpus Check
- 540 files · ~512,274 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 3010 nodes · 9761 edges · 139 communities (117 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 137 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6dd10075`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/src/features/attendance/components/MyAttendanceCalendar.tsx
- useProductCatalog.ts
- useShiftHandover.tsx
- CreateLeaveModal.tsx
- attendance/components/MyAttendanceCalendar.tsx
- lib/api.ts
- seed.ts
- order.service.ts
- types/reports.ts
- InventoryTab.tsx
- useAttendanceTimesheet.ts
- TagCheckScannerModal.tsx
- Kiến trúc Frontend CMS (`cms/`)
- Tiến độ dự án 11 Sport
- ref_react
- shared/productCode.ts
- server/package.json
- web/src/shared/utils/productCode.ts
- serviceOrder.service.ts
- imports.ts
- Feature Danh mục & Sản phẩm (`catalog/`)
- PosTab.tsx
- recode.service.ts
- return.service.ts
- printerPrintLabels.ts
- Repository
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- windowsPrinter.ts
- product.service.ts
- ProductCatalogModule.tsx
- attendance.service.ts
- ref_react
- services/leave/index.ts
- ApiError
- importFileParse.service.ts
- publicStorefront.ts
- web/src/shared/types/promotions.ts
- useViewport.ts
- useShiftSchedule.ts
- 20261113000001-ensure-indexes.ts
- handover.service.ts
- web/src/app/page.tsx
- ocr-speed.test.ts
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- Feature Đơn hàng, Trả/Đổi & Công nợ (`orders/`)
- attendance.ts
- routes/index.ts
- Nghiệp vụ Tích hợp ngoài (`integrations/`)
- Feature Khuyến mãi (`promotions/`)
- Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- cms/src/shared/utils/format.ts
- weeklyPreference.service.ts
- ref_lucide_react
- staffImportParser.ts
- timesheet.queries.ts
- compilerOptions
- normalizeToCompactUpperCode
- Repository
- compilerOptions
- web/src/components/BarcodeLabelModal.tsx
- holidays.controller.ts
- excel.ts
- 2. Danh sách Endpoints
- inventory/exports.ts
- cms/src/app/page.tsx
- utils/productCode.ts
- cms/src/app/api/printers/route.ts
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- holidays.ts
- services
- ocr.ts
- compilerOptions
- Feature Dịch vụ Kỹ thuật (`services/`)
- Feature Xếp ca & Bàn giao ca (`shifts/`)
- volumes
- environment
- StockMovement
- PosTab.tsx
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- formatVND
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Baseline kiểm thử server — 2026-11-12
- http.ts
- scripts
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- healthcheck
- types/index.ts
- hrm.ts
- staff.service.ts
- PosShiftBillsSection.tsx
- cms/src/app/layout.tsx
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- importScan.service.ts
- usePromotionModule.tsx
- imports.controller.ts
- MarketingPushProductsTab.tsx
- attendance/api.ts
- server/scripts/check-architecture.mjs
- middleware/auth.ts
- web/scripts/check-architecture.mjs
- ensure-ocr-data.sh
- repositories/index.ts
- Nghiệp vụ Ngày lễ (`holidays/`)
- Nghiệp vụ Danh mục & Quy chuẩn mã (`catalog/`)
- Nghiệp vụ Kho hàng (`inventory/`)
- Nghiệp vụ Bán hàng, Khách hàng & Công nợ (`orders/`)
- Nghiệp vụ Sản phẩm (`products/`)
- Nghiệp vụ Đổi / Trả hàng (`returns/`)
- Nghiệp vụ Nhân sự (`staff/`)
- mongoose
- InventoryModule.tsx
- scanTag
- ref_path
- CameraScannerModal.tsx
- web/src/shared/lib/search.ts
- ImportReceipt.ts
- staffImport.parser.ts
- Attendance.ts
- StaffListTable.tsx
- cms/scripts/check-architecture.mjs
- web/src/app/api/printers/route.ts
- importPdfInventory.ts
- useMobileTableLabels.ts
- ShiftAssignment.ts
- Kiến trúc Backend (`server/`)
- ref_react
- web/src/app/layout.tsx
- Nghiệp vụ Xếp ca tuần (`shifts/`)
- Nghiệp vụ Bảng công tháng (`timesheet/`)

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 173 edges
2. `ok()` - 109 edges
3. `formatVND()` - 68 edges
4. `apiRequest()` - 61 edges
5. `normalizeToCompactUpperCode()` - 58 edges
6. `getFloorStocks()` - 47 edges
7. `PosTab()` - 39 edges
8. `withPagination()` - 38 edges
9. `generateVariantProductCode()` - 38 edges
10. `created()` - 38 edges

## Surprising Connections (you probably didn't know these)
- `8. Tác động theo phần` --references--> `buildClientFallbackDashboard()`  [INFERRED]
  docs/requirements/doanh-thu-dashboard.md → cms/src/features/reports/fallbackDashboard.ts
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/shared/types/catalog.ts
- `3.2 Kế toán Kho & Sổ kho (Stock Movement)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/catalog.ts
- `3.3 Nhập kho (Import Receipt)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/catalog.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/catalog.ts

## Import Cycles
- None detected.

## Communities (139 total, 22 thin omitted)

### Community 0 - "web/src/features/attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.12
Nodes (32): fetchMyCalendarApi(), markMyShiftScheduleSeenApi(), addLocalDaysStr(), DayCell(), DayDetailModal(), fmtMinutes(), getNextMondayFallbackStr(), InfoBox() (+24 more)

### Community 1 - "useProductCatalog.ts"
Cohesion: 0.15
Nodes (24): CategoryBrandModule(), SubTab, ProductCatalogModule(), COMMON_COLORS, COMMON_SIZES, StockStatusFilter, useProductCatalog(), addProductVariantsApi() (+16 more)

### Community 2 - "useShiftHandover.tsx"
Cohesion: 0.20
Nodes (18): confirmShiftHandoverApi(), deleteShiftHandoverApi(), fetchDailyHandoverCheckApi(), fetchHandoverScheduleConfigApi(), fetchShiftHandoversApi(), updateHandoverScheduleConfigApi(), ShiftHandoverDetailModal(), ShiftHandoverModule() (+10 more)

### Community 3 - "CreateLeaveModal.tsx"
Cohesion: 0.17
Nodes (19): cancelLeaveRequestApi(), createLeaveRequestApi(), fetchMyLeaveRequestsApi(), AvailableOffDayOption, CreateLeaveModal(), LeaveFilter, LeaveFilter, MyLeaveRequestsPanel() (+11 more)

### Community 4 - "attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.24
Nodes (17): fetchMyCalendarApi(), MyAttendanceCalendar(), DayCell(), DayDetailModal(), InfoBox(), Row(), StatCard(), CONTRACT_LABEL (+9 more)

### Community 5 - "lib/api.ts"
Cohesion: 0.08
Nodes (49): AccountProfileTabProps, checkInApi(), checkOutApi(), fetchMyShiftScheduleApi(), getTodayAttendanceApi(), submitShiftPreferencesApi(), AttendanceModal(), Props (+41 more)

### Community 6 - "seed.ts"
Cohesion: 0.17
Nodes (28): An toàn DB, supertest, buildHealthPayload(), createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), getDbMode() (+20 more)

### Community 7 - "order.service.ts"
Cohesion: 0.09
Nodes (57): 1. Hiện trạng đã xác minh trong code, deleteOrders_ByIdHandler, getCustomersHandler, getCustomersLookupHandler, getOrders_ByIdHandler, getOrdersByCode_ByCodeHandler, getOrdersCurrentShiftHandler, getOrdersHandler (+49 more)

### Community 8 - "types/reports.ts"
Cohesion: 0.13
Nodes (20): MyCalendarData, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, DiscountType, OrderItem, SplitPaymentRecord, DailyRevenueTrend (+12 more)

### Community 9 - "InventoryTab.tsx"
Cohesion: 0.08
Nodes (45): InventoryTab(), addProductVariantsApi(), fetchBrandsApi(), lookupProductByCodeApi(), previewProductCodeApi(), describeApiError(), PRODUCT_CODE_ERROR_MESSAGES, useDebounce() (+37 more)

### Community 10 - "useAttendanceTimesheet.ts"
Cohesion: 0.14
Nodes (30): adjustAttendanceApi(), createManualAttendanceApi(), fetchTimesheetApi(), AttendanceTimesheetModule(), ManualAttendanceModal(), Time24Input(), CellDetailModal(), KpiCard() (+22 more)

### Community 11 - "TagCheckScannerModal.tsx"
Cohesion: 0.19
Nodes (16): Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase, ResultKind, scannedOf() (+8 more)

### Community 12 - "Kiến trúc Frontend CMS (`cms/`)"
Cohesion: 0.40
Nodes (4): Cấu trúc thư mục, Khuôn mẫu chuẩn mỗi `src/features/<feature>/`, Kiến trúc Frontend CMS (`cms/`), Quy tắc phụ thuộc một chiều

### Community 13 - "Tiến độ dự án 11 Sport"
Cohesion: 0.17
Nodes (7): 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 14 - "ref_react"
Cohesion: 0.12
Nodes (19): CmsAuthGateProps, CmsChangePasswordModalProps, CmsDrawersProps, CmsHeaderProps, CMS_MENU_ITEMS, CmsModuleType, ROLE_ALLOWED_MODULES, fetchAttendanceConfig() (+11 more)

### Community 15 - "shared/productCode.ts"
Cohesion: 0.11
Nodes (36): assignCategorySkuCodes(), brandTerms(), buildBrandSeedList(), EXTRA_ALIASES, findBrandExact(), findTermIndex(), knownBrandCandidates(), matchBrandInText() (+28 more)

### Community 16 - "server/package.json"
Cohesion: 0.05
Nodes (44): cors, mongodb-memory-server, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies (+36 more)

### Community 17 - "web/src/shared/utils/productCode.ts"
Cohesion: 0.12
Nodes (36): buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), exactCodeMatch(), findProductAndVariantByScannedBarcode(), findProductByScannedBarcode(), getBarcodeCandidates(), isOrderedSubsequence() (+28 more)

### Community 18 - "serviceOrder.service.ts"
Cohesion: 0.11
Nodes (45): deleteServiceTypes_ByIdHandler, getServiceOrders_ByIdHandler, getServiceOrdersHandler, getServiceTypesHandler, patchServiceOrders_ByIdHandler, patchServiceOrders_ByIdStatusHandler, patchServiceTypes_ByIdHandler, postServiceOrders_ByIdPaymentsHandler (+37 more)

### Community 19 - "imports.ts"
Cohesion: 0.07
Nodes (40): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+32 more)

### Community 21 - "PosTab.tsx"
Cohesion: 0.06
Nodes (41): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+33 more)

### Community 22 - "recode.service.ts"
Cohesion: 0.10
Nodes (31): RFC-4180, ApplyOptions, applyRecode(), ApplyReport, assertLocalMongoUri(), backupDatabase(), buildRecodePlan(), bumpVersion() (+23 more)

### Community 23 - "return.service.ts"
Cohesion: 0.10
Nodes (30): getReturnsHandler, postReturnsCalculateHandler, postReturnsHandler, requireRoles(), PaymentMethod, ExchangeItemSchema, IExchangeItem, IReturnExchange (+22 more)

### Community 24 - "printerPrintLabels.ts"
Cohesion: 0.18
Nodes (18): dynamic, GET(), POST(), runtime, CODE128_PATTERNS, compactColorTokenForBarcode(), encodeCode128BPattern(), encodeCode128RawPattern() (+10 more)

### Community 25 - "Repository"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.08
Nodes (25): Holiday, 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions) (+17 more)

### Community 27 - "windowsPrinter.ts"
Cohesion: 0.16
Nodes (19): getPrintersHandler, printLabelsHandler, CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter() (+11 more)

### Community 28 - "product.service.ts"
Cohesion: 0.12
Nodes (66): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), deleteProducts_ByIdHandler, getInventoryMovementsHandler, getInventoryReportHandler, getInventoryTransfersHandler, getProductsHandler, getProductsLookupHandler, patchProducts_ByIdHandler (+58 more)

### Community 29 - "ProductCatalogModule.tsx"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 30 - "attendance.service.ts"
Cohesion: 0.11
Nodes (41): ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`), getAttendanceConfigHandler (+33 more)

### Community 31 - "ref_react"
Cohesion: 0.12
Nodes (32): InventoryPaginationBar(), InventoryPaginationBarProps, parseAndApplyAdminImportFile(), downloadAdminSampleCsv(), useInventoryDerived(), InventoryAdminImportDeps, useInventoryAdminImport(), useInventoryLoaders() (+24 more)

### Community 32 - "services/leave/index.ts"
Cohesion: 0.24
Nodes (23): assertAdvanceNoticeForLeaveRequest(), assertPaidLeaveQuota(), assertSalesUnpaidOffQuota(), ADVANCE_NOTICE_DAYS_REQUIRED, computePaidLeaveBalanceForStaff(), getConsecutivePaidLeaveCluster(), PAID_LEAVE_MAX_CONSECUTIVE_DAYS, PROBATION_MAX_MONTHS (+15 more)

### Community 33 - "ApiError"
Cohesion: 0.11
Nodes (42): deleteBrands_ByIdHandler, getBrandsHandler, patchBrands_ByIdHandler, postBrandsHandler, deleteCategories_ByIdHandler, getCategoriesHandler, patchCategories_ByIdHandler, postCategoriesHandler (+34 more)

### Community 34 - "importFileParse.service.ts"
Cohesion: 0.29
Nodes (17): ensureStandardProductCodesMigrated(), rowsToImportItems(), parseImportFile(), colLettersToIndex(), convertMatrixToImportRows(), decodeXmlEntities(), extractTextFromPdfBuffer(), extractZipEntries() (+9 more)

### Community 35 - "publicStorefront.ts"
Cohesion: 0.08
Nodes (27): StockMovement, 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)* (+19 more)

### Community 36 - "web/src/shared/types/promotions.ts"
Cohesion: 0.25
Nodes (7): EffectivePromotionStatus, Promotion, PromotionConditionCategory, PromotionConditionProduct, PromotionConditionType, PromotionDiscountType, PromotionGiftItem

### Community 37 - "useViewport.ts"
Cohesion: 0.67
Nodes (3): Breakpoint, useBreakpoint(), useIsMobile()

### Community 38 - "useShiftSchedule.ts"
Cohesion: 0.17
Nodes (20): saveShiftChangesApi(), ShiftScheduleModule(), ShiftStaffSidebar(), addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf() (+12 more)

### Community 39 - "20261113000001-ensure-indexes.ts"
Cohesion: 0.27
Nodes (5): migration, migration, toObjectId(), Migration, MigrationContext

### Community 40 - "handover.service.ts"
Cohesion: 0.15
Nodes (33): confirmHandoverHandler, deleteHandoverHandler, getHandoverDailyCheckHandler, getHandoverScheduleConfigHandler, listHandoversHandler, putHandoverScheduleConfigHandler, submitHandoverHandler, attendanceConfigRepo (+25 more)

### Community 41 - "web/src/app/page.tsx"
Cohesion: 0.15
Nodes (23): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), isBlockedFromWebPos(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), toIsoDateSlice() (+15 more)

### Community 42 - "ocr-speed.test.ts"
Cohesion: 0.21
Nodes (11): createCorsMiddleware(), DEFAULT_ORIGINS, privateNetworkAccessMiddleware(), env, bootstrap(), pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs() (+3 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 46 - "attendance.ts"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "routes/index.ts"
Cohesion: 0.08
Nodes (35): express, createLeaveRequestHandler, deleteLeaveRequestHandler, getLeaveRequestsHandler, patchLeaveRequestHandler, getReportsPushProductsHandler, getReportsRevenueDashboardHandler, getReportsStaffActivityHandler (+27 more)

### Community 50 - "Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 51 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.17
Nodes (11): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt), 3.4 Bán hàng (POS Order) & Xuất PDF, 3.5 Trả / Đổi hàng (Return & Exchange), 3. Quy tắc Nghiệp vụ đã chốt (Business Rules) (+3 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "cms/src/shared/utils/format.ts"
Cohesion: 0.09
Nodes (24): ProductCatalogTable(), ProductCatalogViewModel, AdminBatchImportTable(), SetLinkModal(), DebtManagementViewModel, PromotionConditionFields(), PromotionFormModal(), PromotionRewardFields() (+16 more)

### Community 54 - "weeklyPreference.service.ts"
Cohesion: 0.23
Nodes (21): assignSingleShiftHandler, assignWeekBulkHandler, getMyScheduleHandler, getWeeklyScheduleHandler, markMyScheduleSeenHandler, registerWeeklyPreferencesHandler, leaveRequestRepo, shiftAssignmentRepo (+13 more)

### Community 55 - "ref_lucide_react"
Cohesion: 0.29
Nodes (16): ProductCatalogVariantSection(), HistoryTransfersView(), InventoryProductsTable(), InventoryTableFooter(), InventoryTransferTab(), InventoryVariantsPanel(), TransferProductPicker(), ColorInputWithPicker() (+8 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "timesheet.queries.ts"
Cohesion: 0.31
Nodes (20): ShiftCode, adjustAttendanceRecord(), applyManualOffForStaffDate(), createManualAttendance(), buildTimesheet(), getMyAttendanceCalendar(), getTimesheetReport(), parseMonthYear() (+12 more)

### Community 58 - "compilerOptions"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "normalizeToCompactUpperCode"
Cohesion: 0.18
Nodes (22): Issue, main(), checkLine(), compactColorTokenForBarcode(), isCompactBarcodeMatchVariant(), isStandardSixDigitProductCode(), normalizeToCompactUpperCode(), resolveBrandInfo() (+14 more)

### Community 60 - "Repository"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "compilerOptions"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "holidays.controller.ts"
Cohesion: 0.19
Nodes (23): assertHolidayManager(), createHolidayHandler, deleteHolidayHandler, getHolidaysHandler, HOLIDAY_MANAGER_ROLES, syncVnHolidaysHandler, holidayRepo, createHoliday() (+15 more)

### Community 64 - "excel.ts"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2. Danh sách Endpoints"
Cohesion: 0.18
Nodes (11): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), H. `PATCH /api/v1/products/:id` — trường mới, I. `GET /api/v1/products/lookup?code=<mã quét>` (+3 more)

### Community 66 - "inventory/exports.ts"
Cohesion: 0.10
Nodes (49): BrandModule(), exportBrands(), exportCategories(), categoryNameOf(), checkersOf(), exportImports(), exportInventoryReport(), exportMovements() (+41 more)

### Community 67 - "cms/src/app/page.tsx"
Cohesion: 0.10
Nodes (29): CmsAuthGate(), CmsChangePasswordModal(), CmsDrawers(), CmsHeader(), CmsDashboardPage(), AttendanceIpConfigModule(), CategoryModule(), DebtManagementModule() (+21 more)

### Community 68 - "utils/productCode.ts"
Cohesion: 0.07
Nodes (61): inter, metadata, RootLayout(), fetchFirstOkJson(), fetchWithTimeout(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter() (+53 more)

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

### Community 74 - "ocr.ts"
Cohesion: 0.14
Nodes (23): ALLOWED_MIME, buildTagCodes(), buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS, DEFAULT_TAG_MODELS (+15 more)

### Community 75 - "compilerOptions"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 78 - "volumes"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 79 - "environment"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 80 - "StockMovement"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 81 - "PosTab.tsx"
Cohesion: 0.07
Nodes (60): 1. Hiện trạng, 2. Cấu trúc đích, 3. Các giai đoạn (mỗi giai đoạn = 1 commit, build xanh trước khi sang tiếp), 4. Rủi ro & cách giảm, 5. Ngoài phạm vi, 6. Ước lượng, Kế hoạch refactor `web/` theo cấu trúc `cms/`, CustomerTab() (+52 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "formatVND"
Cohesion: 0.26
Nodes (16): RevenueBreakdownCard(), AnimatedNumber(), CHART_COLORS, formatShortVND(), SvgDonutChart(), RevenueDashboardModule(), RevenueDebtTab(), RevenueLineChart() (+8 more)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "http.ts"
Cohesion: 0.12
Nodes (40): Quy ước trong mỗi domain (`services/<domain>/`), getMyCalendarHandler, getTimesheetHandler, patchAttendanceHandler, postManualAttendanceHandler, importReceiptRepo, orderRepo, productRepo (+32 more)

### Community 87 - "scripts"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 96 - "types/index.ts"
Cohesion: 0.18
Nodes (21): OrdersReturnsModuleProps, buildClientFallbackDashboard(), computeFallbackDebtStats(), aggregateOrdersAndReturns(), computeFallbackProductAndCategoryStats(), computeFallbackServiceStats(), buildFallbackPushProducts(), PushProductsReportResponse (+13 more)

### Community 97 - "hrm.ts"
Cohesion: 0.17
Nodes (11): AttendanceConfig, DailyHandoverCategorySummary, LeaveRequest, MyCalendarCellCode, MyCalendarLeave, MyCalendarSummary, ShiftHandoverCategoryCount, ShiftHandoverDiscrepancy (+3 more)

### Community 98 - "staff.service.ts"
Cohesion: 0.17
Nodes (24): getStaffHandler, patchStaff_ByIdHandler, postAuthChangePasswordHandler, postAuthLoginHandler, postStaffHandler, postStaffParseImportFileHandler, invalidateStaffAuthCache(), authStaffRouter (+16 more)

### Community 99 - "PosShiftBillsSection.tsx"
Cohesion: 0.17
Nodes (16): fetchCurrentShiftOrdersApi(), formatPaymentMethodLabel(), formatShiftBadge(), formatShortVnDate(), getLocalDateStr(), getRecentQuickDates(), PosShiftBillsSection(), PosShiftBillsSectionProps (+8 more)

### Community 100 - "cms/src/app/layout.tsx"
Cohesion: 0.17
Nodes (7): dynamic, revalidate, dynamic, revalidate, callWiseQuotes(), GET(), WISE_BASE_URL

### Community 101 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.18
Nodes (10): 10. Phiếu bàn giao → backend-dev, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên, 8. Tác động theo phần (+2 more)

### Community 102 - "importScan.service.ts"
Cohesion: 0.22
Nodes (27): IImportReceiptItem, bumpVersionCode(), findCodeConflictsInList(), findExistingProductForImport(), loadImportSchemeContext(), proposeImportProduct(), resolveExplicitImportSchemeItem(), resolveImportColorCode() (+19 more)

### Community 103 - "usePromotionModule.tsx"
Cohesion: 0.06
Nodes (55): DEBOUNCE_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_OPTIONS, BrandForm, BrandModuleViewModel, CODE_RE, EMPTY_FORM (+47 more)

### Community 104 - "imports.controller.ts"
Cohesion: 0.24
Nodes (14): deleteImports_ByIdHandler, getImports_ByIdHandler, getImportsHandler, postImports_ByIdCompleteHandler, postImports_ByIdFinishListingHandler, postImports_ByIdScanCheckHandler, postImports_ByIdScanTagHandler, postImportsHandler (+6 more)

### Community 105 - "MarketingPushProductsTab.tsx"
Cohesion: 0.10
Nodes (20): buildFallbackPushProducts(), parseLocalDateBound(), PushProductRow, PushProductsReportResponse, CartItem, GiftCartItem, ExchangeItemForm, ExchangeOption (+12 more)

### Community 106 - "attendance/api.ts"
Cohesion: 0.22
Nodes (12): createHolidayApi(), deleteHolidayApi(), fetchHolidays(), syncVietnamHolidaysApi(), HrmAttendanceModule(), HrmHolidaysTab(), HrmAttendanceViewModel, SubTab (+4 more)

### Community 107 - "server/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 108 - "middleware/auth.ts"
Cohesion: 0.11
Nodes (29): attachUserContext(), errorHandler(), Express, Request, resolveActiveStaffCached(), staffCache, createRateLimiter(), getRequestIpKey() (+21 more)

### Community 109 - "web/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 111 - "repositories/index.ts"
Cohesion: 0.04
Nodes (67): deletePromotions_ByIdHandler, getPromotionsHandler, patchPromotions_ByIdHandler, postPromotionsEvaluateHandler, postPromotionsHandler, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig (+59 more)

### Community 112 - "Nghiệp vụ Ngày lễ (`holidays/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Ngày lễ (`holidays/`), Quy tắc chính

### Community 119 - "mongoose"
Cohesion: 0.18
Nodes (7): mongoose, HandoverStatus, IHandoverCategoryCount, IHandoverDiscrepancy, IShiftHandover, ShiftHandoverModel, ShiftHandoverSchema

### Community 120 - "InventoryModule.tsx"
Cohesion: 0.18
Nodes (18): AdminBatchImportModal(), CmsRoleBadge(), HistoryImportsView(), HistoryMovementsView(), ImportReceiptDetailModal(), InventoryHistoryTab(), InventoryModule(), InventoryProductsTab() (+10 more)

### Community 121 - "scanTag"
Cohesion: 0.36
Nodes (10): sanitizeBarcode(), validateOcrInput(), isFullItem(), progressOfItems(), applyMatchedScan(), findRowByKnownBarcode(), scanCheck(), scanTag() (+2 more)

### Community 122 - "ref_path"
Cohesion: 0.14
Nodes (6): args, BASELINE_FILE, current, __dirname, ROUTES_DIR, migration

### Community 123 - "CameraScannerModal.tsx"
Cohesion: 0.16
Nodes (18): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), ImportItem, CameraScannerModal(), CameraScannerModalProps (+10 more)

### Community 124 - "web/src/shared/lib/search.ts"
Cohesion: 0.33
Nodes (8): boundedEditDistanceLeq1(), buildAcronym(), compactAlphaNum(), normalizePhoneDigits(), normalizeVietnamese(), PreparedField, scoreSearchMatch(), SearchField

### Community 125 - "ImportReceipt.ts"
Cohesion: 0.25
Nodes (7): IImportReceipt, ImportReceiptItemSchema, ImportReceiptModel, ImportReceiptSchema, ImportReceiptStatus, IScanCount, WarehouseFloor

### Community 126 - "staffImport.parser.ts"
Cohesion: 0.24
Nodes (16): ColumnKey, inferContractType(), inferRoleAndDepartment(), matchSubHeaderKey(), matchTopHeaderKey(), normalizeCitizenIdCell(), normalizeGenderCell(), normalizePhoneCell() (+8 more)

### Community 127 - "Attendance.ts"
Cohesion: 0.29
Nodes (6): AttendanceCheckInType, AttendanceModel, AttendanceSchema, AttendanceStatus, IAttendance, OvertimeStatus

### Community 128 - "StaffListTable.tsx"
Cohesion: 0.10
Nodes (27): AccountProfileModule(), ProfilePersonalCard(), StaffCreateForm(), StaffCreateHrFields(), StaffEditProfileModal(), StaffEditSalarySection(), StaffImportPreviewModal(), StaffListTable() (+19 more)

### Community 129 - "cms/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 130 - "web/src/app/api/printers/route.ts"
Cohesion: 0.25
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 131 - "importPdfInventory.ts"
Cohesion: 0.28
Nodes (7): dotenv, apiCall(), buildProductName(), FLOOR_1_ITEMS, FLOOR_2_ITEMS, main(), PdfItemRow

### Community 132 - "useMobileTableLabels.ts"
Cohesion: 0.67
Nodes (5): applyTableLabels(), buildColumnLabels(), cellText(), extractFullCellText(), useMobileTableLabels()

### Community 133 - "ShiftAssignment.ts"
Cohesion: 0.40
Nodes (4): IShiftAssignment, ShiftAssignmentModel, ShiftAssignmentSchema, ShiftType

### Community 134 - "Kiến trúc Backend (`server/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc phân tầng (Layered Architecture), Kiến trúc Backend (`server/`), Quy tắc phụ thuộc một chiều

### Community 135 - "ref_react"
Cohesion: 0.14
Nodes (26): useCmsShell(), useBrandModule(), submitAdminBatchImport(), ViewTab, parseStaffImportFileApi(), buildStaffActions(), buildStaffImportActions(), AccountProfileModuleProps (+18 more)

### Community 136 - "web/src/app/layout.tsx"
Cohesion: 0.32
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

### Community 137 - "Nghiệp vụ Xếp ca tuần (`shifts/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Xếp ca tuần (`shifts/`), Quy tắc chính

### Community 138 - "Nghiệp vụ Bảng công tháng (`timesheet/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Bảng công tháng (`timesheet/`), Quy tắc chính

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 760 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `A. Chấm công (`/attendance`)` connect `attendance.service.ts` to `hrm.ts`, `lib/api.ts`, `ProductCatalogModule.tsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/src/features/attendance/components/MyAttendanceCalendar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12100840336134454 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `ApiError` to `order.service.ts`, `serviceOrder.service.ts`, `return.service.ts`, `windowsPrinter.ts`, `product.service.ts`, `attendance.service.ts`, `services/leave/index.ts`, `importFileParse.service.ts`, `handover.service.ts`, `routes/index.ts`, `weeklyPreference.service.ts`, `timesheet.queries.ts`, `holidays.controller.ts`, `ocr.ts`, `http.ts`, `staff.service.ts`, `importScan.service.ts`, `middleware/auth.ts`, `repositories/index.ts`, `scanTag`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Should `useProductCatalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14616755793226383 - nodes in this community are weakly interconnected._
- **Why does `StockMovement` connect `publicStorefront.ts` to `StaffListTable.tsx`, `useProductCatalog.ts`, `inventory/exports.ts`, `Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)`, `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)`, `ref_lucide_react`, `CameraScannerModal.tsx`, `ref_react`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `lib/api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08141321044546851 - nodes in this community are weakly interconnected._